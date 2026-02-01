// screens/AgricLessonDetailScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { chemistryLessons } from '../data/chemistryLessons';

// IMPORTANT: getDBConnection is provided by utils/database.js
import { getDBConnection } from '../utils/database';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Show, Render } from '../components/SafeConditional';
// dbHelper contains the higher-level helpers (updateUserProgress, getCurrentUser, addXP, updateStreak, awardBadge)
import {
  incrementQuizCountForToday,
  recordQuizThresholdIfEligible,
  recordQuizCompletion,
  getCurrentUser,
  updateUserProgress,
  addXP,
  updateStreak,
  awardBadge,
  addUserPieces,
  markLessonCompleted,
} from '../utils/dbHelper';

const SUBJECT_NAME = 'Chemistry';
const MAX_POINTS_PER_QUESTION = 1; // each question is worth 1 point

const ChemistryLessonDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { topicIndex } = route.params ?? {};
  const lesson = chemistryLessons?.[topicIndex];

  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  const [saving, setSaving] = useState(false);

  // QUIZ STREAK UI state
  const [showQuizStreakPopup, setShowQuizStreakPopup] = useState(false);
  const confettiRef = useRef(null);
  const [fireConfettiCount, setFireConfettiCount] = useState(0);

  useEffect(() => {
    if (!lesson) {
      Alert.alert('Not found', 'Lesson not found.');
      navigation.goBack();
      return;
    }
    checkIfTaken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicIndex]);

  const checkIfTaken = async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        setAlreadyTaken(false);
        setLoading(false);
        return;
      }

      const db = await getDBConnection();

      // ensure topic_attempts exists
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS topic_attempts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          subject TEXT,
          topic TEXT,
          points INTEGER,
          date TEXT
        );
      `);

      const res = await db.executeSql(
        `SELECT * FROM topic_attempts WHERE user_id = ? AND subject = ? AND topic = ? LIMIT 1;`,
        [user.id, SUBJECT_NAME, lesson.title]
      );

      if (res[0].rows.length > 0) {
        const rec = res[0].rows.item(0);
        setAlreadyTaken(true);
        setScore(rec.points);
        setSubmitted(true);
      } else {
        setAlreadyTaken(false);
      }
    } catch (err) {
      console.error('checkIfTaken error:', err);
      setAlreadyTaken(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (questionIndex, option) => {
    if (submitted || alreadyTaken) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionIndex]: option }));
  };

  const handleSubmit = async () => {
    if (!lesson?.quiz || lesson.quiz.length === 0) {
      Alert.alert('No quiz', 'This lesson does not have a quiz.');
      return;
    }

    if (Object.keys(selectedAnswers).length < lesson.quiz.length) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }

    setSaving(true);
    try {
      let points = 0;
      lesson.quiz.forEach((q, idx) => {
        if (selectedAnswers[idx] === q.answer) points += MAX_POINTS_PER_QUESTION;
      });

      // Use central updateUserProgress to record attempt (user_scores, leaderboard, periods)
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Sign in', 'Please sign in to save your score.');
        setSaving(false);
        return;
      }

      await updateUserProgress(user.id, SUBJECT_NAME, points, {
        saveToLeaderboard: true,
        username: user.name || user.email || 'Unknown',
        recordPeriod: true,
      });

      // Also insert into topic_attempts so we can block retakes for this lesson
      const db = await getDBConnection();
      const now = new Date().toISOString();
      await db.executeSql(
        `CREATE TABLE IF NOT EXISTS topic_attempts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          subject TEXT,
          topic TEXT,
          points INTEGER,
          date TEXT
        );`
      );
      await db.executeSql(
        `INSERT INTO topic_attempts (user_id, subject, topic, points, date) VALUES (?, ?, ?, ?, ?);`,
        [user.id, SUBJECT_NAME, lesson.title, points, now]
      );

      await markLessonCompleted(
        user.id,
        'chemistry',   // subject key (string)
        lesson.id        // lesson key from JS file
      
      );
            
      // Auxiliary updates: XP, daily quiz count, 10-quiz threshold -> award pieces
      try {
        const xpEarned = Math.max(1, points * 10);
        await addXP(user.id, xpEarned);

        // --- maintain quiz_daily exactly as before (safe and local) ---
        const db2 = await getDBConnection();
        const today = new Date().toISOString().split('T')[0];

        await db2.executeSql(`
          CREATE TABLE IF NOT EXISTS quiz_daily (
            user_id INTEGER,
            date TEXT,
            quiz_count INTEGER,
            PRIMARY KEY (user_id, date)
          );
        `);

        await db2.executeSql(
          `INSERT OR IGNORE INTO quiz_daily (user_id, date, quiz_count) VALUES (?, ?, 0);`,
          [user.id, today]
        );

        await db2.executeSql(
          `UPDATE quiz_daily SET quiz_count = quiz_count + 1 WHERE user_id = ? AND date = ?;`,
          [user.id, today]
        );

        const q = await db2.executeSql(
          `SELECT quiz_count FROM quiz_daily WHERE user_id = ? AND date = ?;`,
          [user.id, today]
        );
        const quizCount = q[0].rows.item(0).quiz_count;

        // ONLY when quizCount === 2 (exactly) => award pieces & mark calendar
        if (quizCount === 2) {
          try {
            // 1️⃣ Existing logic (KEEP IT)
            await addUserPieces(user.id, 2);
            await recordQuizThresholdIfEligible(user.id, today);
            await recordQuizCompletion(user.id);

            // 2️⃣ HARD GUARANTEE: mark day as completed (green)
            const db3 = await getDBConnection();
            await db3.executeSql(
              `
              INSERT OR REPLACE INTO daily_streak (user_id, date, completed)
              VALUES (?, ?, 1)
              `,
              [user.id, today]
            );

            // 3️⃣ UI feedback (KEEP)
            setShowQuizStreakPopup(true);
            setTimeout(() => setFireConfettiCount(v => v + 1), 120);
            setTimeout(() => setShowQuizStreakPopup(false), 7000);

          } catch (err) {
            console.warn('Streak / reward error:', err);
          }
        }


        // If perfect score: award perfect badge (already present) and fire confetti as requested
        if (points === lesson.quiz.length * MAX_POINTS_PER_QUESTION) {
          try {
            await awardBadge(user.id, `Perfect - ${lesson.title}`);
            // fire confetti for perfect too (but do NOT award pieces unless quizCount === 10)
            setTimeout(() => setFireConfettiCount((v) => v + 1), 120);
          } catch (badErr) {
            console.warn('awardBadge failed', badErr);
          }
        }
      } catch (aux) {
        console.warn('aux updates failed', aux);
      }

      setScore(points);
      setSubmitted(true);
      setAlreadyTaken(true);
      Alert.alert('Quiz Completed', `You scored ${points}/${lesson.quiz.length}!`);
    } catch (err) {
      console.error('handleSubmit error:', err);
      Alert.alert('Error', 'Could not save your quiz result. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>

      {/* ================= LOADING ================= */}
      <Show when={loading === true}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      </Show>

      {/* ================= MAIN CONTENT ================= */}
      <Show when={loading !== true}>

        {/* ================= QUIZ STREAK POPUP ================= */}
        <Show when={showQuizStreakPopup === true}>
          <Modal visible transparent animationType="fade">
            <View style={styles.popupOverlay}>
              <View style={styles.popupBox}>

                <Text style={styles.popupTitle}>
                  🎉 Streak Complete!
                </Text>

                <Text style={styles.popupText}>
                  Great job! You completed 2 quizzes today and earned 2 pieces.
                </Text>

                <Text style={styles.popupReward}>
                  +2 pieces
                </Text>

                <TouchableOpacity
                  onPress={() => setShowQuizStreakPopup(false)}
                  style={styles.popupBtn}
                >
                  <Text style={styles.popupBtnText}>OK</Text>
                </TouchableOpacity>

              </View>
            </View>
          </Modal>
        </Show>

        {/* ================= CONFETTI ================= */}
        <Show when={fireConfettiCount > 0 && !!ConfettiCannon}>
          <ConfettiCannon
            key={`quiz-confetti-${fireConfettiCount}`}
            count={80}
            origin={{ x: -10, y: 0 }}
            fadeOut
          />
        </Show>

        {/* ================= CONTENT ================= */}
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 50 }}
        >

          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              {String(lesson?.title || '')}
            </Text>
          </View>

          {/* LESSON CONTENT */}
          <Text style={styles.lessonText}>
            {String(lesson?.content || '')}
          </Text>

          <Text style={styles.quizTitle}>Quiz</Text>

          {/* ================= ALREADY TAKEN INFO ================= */}
          <Show when={alreadyTaken === true}>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ✅ You have completed this quiz.
              </Text>
              <Text style={styles.infoSubText}>
                Correct answers are shown below for revision.
              </Text>

              <Show when={typeof score === 'number'}>
                <Text style={styles.infoSubText}>
                  Your score: {score}/{lesson?.quiz?.length ?? 0}
                </Text>
              </Show>
            </View>
          </Show>

          {/* ================= QUESTIONS ================= */}
          <Show when={Array.isArray(lesson?.quiz)}>
            {lesson.quiz.map((q, i) => {
              const selected = selectedAnswers?.[i];
              const isCorrect =
                submitted === true && selected === q.answer;
              const isWrong =
                submitted === true && selected && selected !== q.answer;
              const showCorrectAnswer =
                submitted === true &&
                (isWrong === true || alreadyTaken === true);


              return (
                <View key={`q-${i}`} style={styles.quizBlock}>

                  <Text style={styles.question}>
                    {i + 1}. {String(q?.question || '')}
                  </Text>

                  <Show when={Array.isArray(q?.options)}>
                    {q.options.map((opt, j) => {
                      const chosen = selected === opt;

                      const optionStyles = [
                        styles.option,
                        chosen && styles.optionSelected,
                        isCorrect && opt === q.answer && styles.optionCorrect,
                        isWrong && chosen && styles.optionWrong,
                      ];

                      return (
                        <TouchableOpacity
                          key={`opt-${j}`}
                          style={optionStyles}
                          onPress={() => handleSelect(i, opt)}
                          disabled={submitted || alreadyTaken}
                        >
                          <Text style={styles.optionText}>
                            {String(opt)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </Show>

                  {/* CORRECT ANSWER */}
                  <Show when={showCorrectAnswer}>
                    <Text style={styles.correctAnswer}>
                      Correct answer:{' '}
                      <Text style={styles.correctValue}>
                        {String(q?.answer)}
                      </Text>
                    </Text>
                  </Show>

                </View>
              );
            })}
          </Show>

          {/* ================= SUBMIT BUTTON ================= */}
          <Show when={submitted === false && alreadyTaken === false}>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                saving && { opacity: 0.7 },
              ]}
              onPress={handleSubmit}
              disabled={saving}
            >
              <Text style={styles.submitText}>
                {saving ? 'Saving...' : 'Submit Quiz'}
              </Text>
            </TouchableOpacity>
          </Show>

          {/* ================= LEADERBOARD ================= */}
          <Show when={submitted === true || alreadyTaken === true}>
            <TouchableOpacity
              style={styles.leaderboardBtn}
              onPress={() =>
                navigation.navigate('MainDrawer', {
                  screen: 'LeaderBoard',
                  params: { subjectId: 'Chemistry' },
                })
              }
            >
              <Text style={styles.leaderboardText}>
                View Leaderboard
              </Text>
            </TouchableOpacity>
          </Show>

        </ScrollView>
      </Show>

    </View>
  );



};

export default ChemistryLessonDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 18 },
  header: {
    backgroundColor: '#001F54',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 10 },
  lessonText: { fontSize: 16, lineHeight: 22, color: '#333', marginBottom: 18 },
  quizTitle: { fontSize: 18, fontWeight: '700', marginTop: 6, color: '#001F54', marginBottom: 8 },
  quizBlock: { marginBottom: 14 },
  question: { fontSize: 15, fontWeight: '600', marginBottom: 8, color: '#222' },
  option: {
    backgroundColor: '#f6f7fb',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  optionText: { fontSize: 15, color: '#111' },
  optionSelected: { borderWidth: 2, borderColor: '#001F54' },
  optionCorrect: { backgroundColor: '#dcedc8' },
  optionWrong: { backgroundColor: '#ffcdd2' },
  submitBtn: {
    backgroundColor: '#001F54',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  leaderboardBtn: {
    marginTop: 12,
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 10,
  },
  leaderboardText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  infoBox: {
    backgroundColor: '#eef7ff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  infoText: { color: '#0b66d1', fontWeight: '700' },
  infoSubText: { color: '#333', marginTop: 4 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  popupOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.36)',
  justifyContent: 'center',
  alignItems: 'center',
},
  popupBox: {
    width: '82%',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  popupTitle: { fontSize: 22, fontWeight: '700' },
  popupText: { textAlign: 'center', marginTop: 6 },
  popupReward: {
    marginTop: 8,
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '700',
  },
  popupBtn: {
    marginTop: 14,
    padding: 10,
    backgroundColor: '#001F54',
    borderRadius: 8,
  },
  popupBtnText: { color: '#fff', fontWeight: '700' },
  correctAnswer: {
    color: '#d32f2f',
    fontWeight: '700',
    marginTop: 6,
  },
  correctValue: { color: '#2e7d32' },

});
