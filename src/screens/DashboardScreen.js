// screens/DashboardScreen.js
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import HeaderTitle from '../components/HeaderTitle';
import {
  getCurrentUser,
  getAllSubjects,
  enrollInSubject,
  payEnrollmentLocally,
  getUserEnrollments,
  recordDailyLoginPending,
  getFreeUnlocksForUser,
  claimFreeUnlock,
  ensureInitialized,
  getUserPieces,
  getQuizThresholdDates,
  getMonthlyLoginHistory,
  getQuizRecordsForMonth,
  getSubjectProgress,
  getUserStreakDays,
} from '../utils/dbHelper';
import { getDBConnection } from '../utils/database';
import { AuthContext } from '../context/AuthContext';
import { Show, Render } from '../components/SafeConditional';




// Optional celebratory imports - install if you want confetti & sound
let ConfettiCannon = null;
try {
  // dynamic require so app still runs if lib not installed
  // eslint-disable-next-line global-require
  ConfettiCannon = require('react-native-confetti-cannon').default;
} catch (e) {
  ConfettiCannon = null;
}

let Sound = null;
try {
  // eslint-disable-next-line global-require
  Sound = require('react-native-sound');
} catch (e) {
  Sound = null;
}

/**
 * DashboardScreen (updated)
 * - Calendar first (30 days) as requested (3 rows x 10)
 * - Uses recordDailyLoginPending() to show immediate login popup (awards +2 to leaderboard)
 * - Day is only marked (counted) when user completes the 10-quiz threshold (handled elsewhere)
 * - Shows pieces count + conversion
 */

const SmallCircle = ({ state, label }) => {
  // state: 'filled' | 'empty' | 'today_pending'
  const base = {
    width: 28,
    height: 28,
    borderRadius: 14,
    margin: 4,
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (state === 'filled') {
    return <View style={[base, { backgroundColor: '#2ecc71' }]} />;
  }
  if (state === 'today_pending') {
    return (
      <View style={[base, { borderWidth: 2, borderColor: '#FFCC00', backgroundColor: '#fff' }]}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFCC00' }} />
      </View>
    );
  }
  // empty
  return <View style={[base, { borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' }]} />;
};

const guard = (v, label = 'unknown') => {
  if (typeof v === 'string') {
    console.error('❌ STRING RENDERED:', label, v);
  }
  return null;
};

const BottomToast = ({ message, visible }) => {
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 30, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  if (typeof message !== 'string' || message.length === 0 || !visible) {
    return null;
  }


  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.toast,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useContext(AuthContext);

  // UI state
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [loading, setLoading] = useState(true);

  const [quizDates, setQuizDates] = useState([]);

  const [quizCompletedDates, setQuizCompletedDates] = useState([]);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [previousStreak, setPreviousStreak] = useState(0);
  const [streakAward, setStreakAward] = useState({ awardedPoints: 0, monthlyAwarded: false, ninetyAwarded: false });
  let autoHideTimer = null;
  // Instant login popup state
  const [showInstantStreakPopup, setShowInstantStreakPopup] = useState(false);
  const [loginAwardPoints, setLoginAwardPoints] = useState(0);
  // New: instant popup + toast states
  const [showToastMsg, setShowToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);


  const [fetchUserPieces, setFetchUserPieces] = useState(() => async () => {
    try {
      const sessionUser = await getCurrentUser();
      if (!sessionUser) return;
      const pcs = await getUserPieces(sessionUser.id);
      setUserPieces(pcs || 0);
    } catch (e) {
      console.warn('fetchUserPieces failed', e);
    }
  });


  const [resume, setResume] = useState(null);
  const [continueSubject, setContinueSubject] = useState(null);
  const [progress, setProgress] = useState(0);

  // Data state
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);
  const [subjects, setSubjects] = useState([]); // {id,name,price,is_free}l: '1', lastSubject: 'Maths' });

  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const todayDay = new Date().getDate();
  const [userPieces, setUserPieces] = useState(0);
  //const [fireConfetti, setFireConfetti] = useState(0);

  // Pieces & streak state
  const [piecesCount, setPiecesCount] = useState(0); // number of pieces user has
  const [streakCount, setStreakCount] = useState(0); // consecutive streak (from daily_logins.streak)
  const [dailyLoginMeta, setDailyLoginMeta] = useState({
    loggedInToday: false,
    counted: false,
    quiz_count_today: 0,
    monthlyAwarded: false,
  });


  const getResumeLesson = async () => {
    const db = await getDBConnection();

    const [res] = await db.executeSql(
      `
      SELECT subject_id, lesson_id
      FROM last_lesson
      WHERE user_id = ?
      `,
      [user.id]
    );

    if (res.rows.length > 0) {
      setResume(res.rows.item(0));
    } else {
      setResume(null);
    }
  };

  const getContinueSubject = async () => {
    const db = await getDBConnection();

    const [res] = await db.executeSql(
      `
      SELECT subject_id, subject_name
      FROM enrollments
      WHERE user_id = ?
        AND (paid = 1 OR payment_status = 'paid' OR amount = 0)
        AND (expiry_date IS NULL OR expiry_date >= DATE('now'))
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [user.id]
    );

    if (res.rows.length > 0) {
      setContinueSubject(res.rows.item(0));
    } else {
      setContinueSubject(null);
    }
  };


const loadProgress = async () => {
  if (!continueSubject || !user?.id) return;

  const percent = await getSubjectProgress(
    user.id,
    continueSubject.subject_id   // ✅ REAL FIELD
  );

  setProgress(percent);
};


const getCompletedDays = async (userId) => {
  const db = await getDBConnection();

  const res = await db.executeSql(
    `SELECT date FROM daily_streak WHERE user_id = ? AND completed = 1`,
    [userId]
  );

  const days = [];
  for (let i = 0; i < res[0].rows.length; i++) {
    days.push(res[0].rows.item(i).date);
  }
  return days;
};

const loadCompletedDays = async (userId) => {
  try {
    const days = await getCompletedDays(userId);
    setQuizCompletedDates(days || []);
  } catch (err) {
    console.warn('Failed to load completed days:', err);
  }
};

  // maps last subject to correct screen
  const mapLastSubject = (last) => {
    if (!last) return 'Subjects';

    const normalized = last.toLowerCase();

    if (normalized.includes('math')) return 'MathsSubject';
    if (normalized.includes('english')) return 'EnglishSubject';
    if (normalized.includes('physics')) return 'PhysicsSubject';
    if (normalized.includes('chem')) return 'ChemistrySubject';
    if (normalized.includes('bio')) return 'BiologySubject';
    if (normalized.includes('agri')) return 'AgricSubject';

    return 'Subjects';
  };

  // confetti
  const confettiRef = useRef(null);
  const [fireConfetti, setFireConfetti] = useState(0);
  const loadMonthlyRecords = async () => {
    const user = await getCurrentUser();
    if (!user) return;

    const days = await getUserStreakDays(user.id);
    const pcs = await getUserPieces(user.id);

    setMonthlyRecords(days || []);
    setUserPieces(pcs || 0);
  };

  const loadQuizRecords = async () => {
    if (!user?.id) return;

    const db = await getDBConnection();
    const [res] = await db.executeSql(
      `SELECT date_string FROM quiz_records WHERE user_id = ?`,
      [user.id]
    );

    const arr = [];
    for (let i = 0; i < res.rows.length; i++) {
      arr.push(res.rows.item(i).date_string);
    }

  };
  useEffect(() => {
    let mounted = true;
    let autoHideTimer = null;

    const init = async () => {
      try {
        await ensureInitialized();

        const sessionUser = await getCurrentUser();
        if (!sessionUser || !mounted) {
          setLoading(false);
          return;
        }

        // 🔁 Load completed quiz days (single source of truth)
        await loadCompletedDays(sessionUser.id);

        // Load DB user
        const db = await getDBConnection();
        db.transaction((tx) => {
          tx.executeSql(
            `SELECT id, name, level, last_subject FROM users WHERE id = ? LIMIT 1;`,
            [sessionUser.id],
            (_, results) => {
              if (!mounted) return;

              if (results.rows.length > 0) {
                const row = results.rows.item(0);
                setUser({
                  id: row.id,
                  name: row.name || 'Guest',
                  level: String(row.level || '1'),
                  lastSubject: row.last_subject || 'Maths',
                });
              } else {
                setUser({
                  id: sessionUser.id,
                  name: sessionUser.name || 'Guest',
                  level: String(sessionUser.level || '1'),
                  lastSubject: sessionUser.lastSubject || 'Maths',
                });
              }
            }
          );
        });

        // Load pieces
        const pcs = await getUserPieces(sessionUser.id);
        if (mounted) setUserPieces(pcs || 0);

        // Load quiz records
        loadQuizRecords();

        // Load subjects
        const subs = await getAllSubjects();
        if (mounted) setSubjects(subs || []);

        // Load enrollments
        const enrolls = await getUserEnrollments(sessionUser.id);
        if (mounted) {
          setEnrolledSubjects(
            Array.isArray(enrolls)
              ? enrolls.map(e => e.subject_name || e.subject)
              : []
          );
        }

        await getContinueSubject();
        await getResumeLesson();      

        // 🔥 SINGLE & FINAL DAILY LOGIN CALL
        const streakRes = await recordDailyLoginPending(sessionUser.id);

        if (mounted && streakRes) {
          setStreakCount(streakRes.streak || 0);
          setStreakAward({
            awardedPoints: streakRes.awardedPoints || 0,
            monthlyAwarded: streakRes.monthlyAwarded,
          });

          // Load finalized login days
          const history = await getMonthlyLoginHistory(sessionUser.id, 30);
          const dates = Array.isArray(history)
            ? history.filter(h => h.finalized).map(h => h.date)
            : [];
        

          // ✅ SHOW POPUP (THIS IS WHAT YOU WERE MISSING)
          if ((streakRes.awardedPoints || 0) > 0) {
            setShowInstantStreakPopup(true);
            showToast(`+${streakRes.awardedPoints || 2} points for logging in today!`);
            playStreakSound();

            if (streakRes.monthlyAwarded) {
              setFireConfetti(s => s + 1);
            }

            autoHideTimer = setTimeout(() => {
              if (mounted) setShowInstantStreakPopup(false);
            }, 7000);

            setShowStreakModal(true);
          }
        }

      } catch (err) {
        console.error('Dashboard init error', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      if (autoHideTimer) clearTimeout(autoHideTimer);
    };
  }, []);


  useEffect(() => {
    if (!continueSubject || !user) return;

    getSubjectProgress(user.id, continueSubject.subject_name)
      .then(setProgress)
      .catch(console.error);
  }, [continueSubject]);


  useFocusEffect(
  useCallback(() => {
    let isActive = true;

    const loadDashboardData = async () => {
      try {
        if (!user?.id) return;

        // 1️⃣ Streak & calendar
        await fetchUserPieces();
        await loadCompletedDays(user.id);

        // 2️⃣ Quiz records (calendar dots)
        const today = new Date();
        const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const records = await getQuizRecordsForMonth(user.id, ym);
        if (isActive) setQuizDates(records);

        // 3️⃣ Continue subject
        await getContinueSubject();

        // 4️⃣ Resume last lesson
        await getResumeLesson();

        // 5️⃣ Progress %
        if (continueSubject?.subject_name) {
          const pct = await getSubjectProgress(user.id, continueSubject.subject_name);
          if (isActive) setProgress(pct);
        }

      } catch (err) {
        console.error('Dashboard reload error:', err);
      }
    };

    loadDashboardData();

    return () => {
      isActive = false;
    };
  }, [user?.id, continueSubject?.subject_name])
);



  const showToast = (message, duration = 2800) => {
    setShowToastMsg(message);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setShowToastMsg(''), 300);
    }, duration);
  };


  // simple sound play (requires react-native-sound)
  const playStreakSound = () => {
    try {
      if (!Sound) return;
      // ensure file is bundled or use a short beep from remote. Here we use built-in tone on iOS/Android if available
      // If you have a local file: new Sound('streak.mp3', Sound.MAIN_BUNDLE, (e) => {...})
      const tone = new Sound('streak.mp3', Sound.MAIN_BUNDLE, (err) => {
        if (err) {
          // fallback: try 'beep.wav' or simply ignore
          // console.warn('Sound load failed', err);
          return;
        }
        tone.setVolume(0.9);
        tone.play(() => {
          tone.release();
        });
      });
    } catch (e) {
      // ignore if library not available or file missing
    }
  };


  // pieces refresh helper
  const refreshPieces = async () => {
    try {
      const sessionUser = await getCurrentUser();
      if (!sessionUser) return;
      const p = await getUserPieces(sessionUser.id);
      setPiecesCount(Number(p || 0));
    } catch (e) {
      console.warn('refreshPieces failed', e);
    }
  };

  // =========================
// CALENDAR RENDER (SAFE)
// =========================
  const renderCalendar = () => {
    // safety
    const completedDays = Array.isArray(quizCompletedDates)
      ? quizCompletedDates.map(d => {
          if (typeof d === 'string') return d.split('T')[0]; // YYYY-MM-DD
          if (d instanceof Date)
            return d.toISOString().split('T')[0];
          return null;
        }).filter(Boolean)
      : [];

    const todayString = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    return (
      <View style={styles.calendarContainer}>
        <Text style={styles.calendarTitle}>Daily Streak</Text>

        <View style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;

              const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

              const isCompleted = completedDays.includes(dateString);
              const isToday = dateString === todayString;

              return (
                <View
                  key={dateString}
                  style={[
                    styles.dayCircle,
                    isCompleted && { backgroundColor: '#4CAF50' },
                    isToday && { borderWidth: 3, borderColor: '#001F54' }
                  ]}
                >
                  <Text
                    style={{
                      color: isCompleted ? '#fff' : '#001F54',
                      fontWeight: '700',
                    }}
                  >
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={{ marginTop: 8, fontSize: 16, fontWeight: '700', color: '#001F54' }}>
          TOTAL: {userPieces ?? 0} PCS
        </Text>
      </View>
    );
  };



  // =========================
  // INSTANT STREAK POPUP
  // =========================
  const InstantStreakPopup = () => (
    <Modal visible animationType="fade" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.36)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '82%', backgroundColor: '#fff', padding: 18, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>🎉 Login Reward!</Text>

          <Text style={{ textAlign: 'center', marginTop: 6 }}>
            Great job,
            <Text style={{ fontWeight: '700' }}>
              {' '}
              {String(user?.name ?? 'User')}
            </Text>
            ! You didn&apos;t miss today&apos;s login. ✅
          </Text>

          <Text style={{ marginTop: 8, fontSize: 18, color: '#007AFF', fontWeight: '700' }}>
            +{String(streakAward?.awardedPoints ?? 2)} points
          </Text>

          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Show when={streakCount >= 30}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>30d</Text>
              </View>
            </Show>

            <Show when={streakCount >= 90}>
              <View style={[styles.badge, { backgroundColor: '#FFAA33' }]}>
                <Text style={styles.badgeText}>90d</Text>
              </View>
            </Show>
          </View>

          <TouchableOpacity
            onPress={() => setShowInstantStreakPopup(false)}
            style={{ marginTop: 14, padding: 10, backgroundColor: '#001F54', borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // =========================
  // LOADING (SAFE)
  // =========================
  if (loading === true) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#001F54" />
      </View>
    );
  }

  // =========================
  // MAIN RENDER
  // =========================
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowMenu(true)}>
          <Icon name="menu" size={28} color="#fff" />
        </TouchableOpacity>

        <HeaderTitle />

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Enrollment')}
            style={{ marginRight: 10 }}
          >
            <Icon name="plus-circle" size={26} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowOptions(true)}>
            <Icon name="dots-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.screenTitle}>Dashboard</Text>

        {/* OPTIONS */}
        <Modal
          transparent
          animationType="fade"
          visible={showOptions}
          onRequestClose={() => setShowOptions(false)}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setShowOptions(false)}
          >
            <View style={styles.popup}>
              <TouchableOpacity
                onPress={() => {
                  setShowOptions(false);
                  navigation.navigate('AboutCompany');
                }}
              >
                <Text style={styles.popupText}>About Company</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowOptions(false);
                  logout?.();
                }}
              >
                <Text style={styles.popupText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* MENU */}
        <Show when={showMenu === true}>
          <Modal visible animationType="slide" transparent>
            <View style={styles.menuOverlay}>
              <View style={styles.menuContainer}>
                <Text style={styles.menuTitle}>Menu</Text>

                {['Dashboard', 'Subjects', 'Profile'].map(item => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => {
                      setShowMenu(false);
                      navigation.navigate(item);
                    }}
                  >
                    <Text style={styles.menuItem}>{String(item)}</Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity onPress={() => setShowMenu(false)}>
                  <Text style={styles.menuClose}>Close ✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </Show>

        {/* WELCOME */}
        <View style={{ marginTop: 5, marginBottom: 18, paddingHorizontal: 10 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#001F54' }}>
            Welcome! {String(user?.name ?? '')}
          </Text>
              <View style={styles.continueRow}>
                <TouchableOpacity
                  disabled={!continueSubject}
                  onPress={() => {
                    if (!continueSubject) return;

                    const targetScreen = mapLastSubject(continueSubject.subject_name);
                    navigation.navigate(targetScreen, {
                      subjectId: continueSubject.subject_id,
                      subjectName: continueSubject.subject_name,
                    });
                  }}
                >
                  <Text style={styles.continueText}>
                    Continue: {continueSubject?.subject_name ?? 'None'}
                  </Text>
                </TouchableOpacity>
            <Text style={styles.progressText}>
              Progress: {progress ?? 0}%
            </Text>
          </View>

        </View>

        {/* CALENDAR */}
        <Show when={typeof renderCalendar === 'function'}>
          {renderCalendar()}
        </Show>


        {/* GRID */}
        <View style={styles.grid}>
          {[
            { label: 'My Courses', screen: 'Subjects' },
            { label: 'Leader Board', screen: 'LeaderBoard' },
            { label: 'Profile', screen: 'Profile' },
            { label: 'Update App', alert: true },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={styles.card}
              onPress={() =>
                item.alert
                  ? Alert.alert('Update App', 'Coming soon')
                  : navigation.navigate(item.screen)
              }
            >
              <Text style={styles.cardText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* CONFETTI */}
      <Show when={fireConfetti > 0 && typeof ConfettiCannon === 'function'}>
        <ConfettiCannon
          key={`confetti-${fireConfetti}`}
          count={120}
          origin={{ x: -10, y: 0 }}
          fadeOut
          ref={confettiRef}
        />
      </Show>

      {/* INSTANT POPUP */}
      <Show when={showInstantStreakPopup === true}>
        <InstantStreakPopup />
      </Show>

      {/* STREAK MODAL */}
      <Show when={showStreakModal === true}>
        <Modal visible transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: '85%', backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
                🎉 Daily Streak
              </Text>

              <Text style={{ textAlign: 'center' }}>
                You earned +{String(streakAward?.awardedPoints ?? 2)} points for today&apos;s login.
              </Text>

              <Show when={streakAward?.monthlyAwarded === true}>
                <Text style={{ marginTop: 8, color: '#007AFF' }}>
                  Bonus: +50 points for 30-day streak!
                </Text>
              </Show>

              <TouchableOpacity
                onPress={() => setShowStreakModal(false)}
                style={{ marginTop: 16, padding: 10, backgroundColor: '#001F54', borderRadius: 8 }}
              >
                <Text style={{ color: '#fff' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Show>

      {/* TOAST */}
      <BottomToast
        message={typeof showToastMsg === 'string' ? showToastMsg : ''}
        visible={toastVisible === true}
      />
    </SafeAreaView>
  );


};

export default DashboardScreen;

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 20, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#001F54',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,

    // 🔥 THIS FIXES IT
    paddingTop:
      Platform.OS === 'android'
        ? StatusBar.currentHeight
        : 0,
  },

  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#001F54',
    marginVertical: 20,
    marginLeft: 0,
    marginTop: 0,
    textAlign: 'center',
  },
  popup: {
    position: 'absolute',
    top: 60,        // below header
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 160,
    paddingVertical: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  popupText: { padding: 12, fontSize: 16, color: '#001F54' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start' },
  menuContainer: { backgroundColor: '#fff', padding: 20, paddingTop: 50, width: '70%', height: '100%' },
  menuTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#001F54' },
  menuItem: { fontSize: 16, paddingVertical: 12, color: '#001F54' },
  menuClose: { fontSize: 24, color: 'red',marginTop: 30 },

  // calendar styles
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 12,
    marginBottom: 18,
    // subtle shadow
    elevation: 1,
  },
  calendarTitle: { fontSize: 15, fontWeight: '700', color: '#001F54' },
  calendarRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginTop: 6 },


  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 15 },
  card: {
    width: '47%',
    backgroundColor: '#001F54',
    padding: 45,
    borderRadius: 12,
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  cardText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    width: '85%',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#001F54',
    marginBottom: 15,
    textAlign: 'center',
  },
  subjectItem: {
    borderWidth: 1,
    borderColor: '#001F54',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  subjectText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#001F54',
  },
  closeButton: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'red',
  },
  payButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#001F54',
    borderRadius: 8,
  },

  // small badges & styles
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#E8F0FF',
    borderRadius: 6,
    marginHorizontal: 6,
  },
  badgeText: { fontWeight: '700', color: '#001F54' },


  // toast
  toast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 18,
    left: 20,
    right: 20,
    backgroundColor: '#001F54',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { color: '#fff', fontWeight: '700' },

  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },

  continueText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A3D91',
  },

  progressText: {
    fontSize: 15,
    color: '#666',
  },

  dayCircle: {
    width: 45,
    height: 45,
    borderRadius: 45,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E6E6E6',
  }

});
