// screens/AgricSubjectScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { agricTopics } from '../data/agricTopics';
// NOTE: getDBConnection lives in utils/database.js (not dbHelper)
import { getDBConnection } from '../utils/database';
import { getCurrentUser } from '../utils/dbHelper';
import { Show, Render } from '../components/SafeConditional';

const SUBJECT_NAME = 'Agriculture';

const AgricSubjectScreen = () => {
  const navigation = useNavigation();
  const [completedTopics, setCompletedTopics] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      loadCompletedTopics();
    });
    // initial load
    loadCompletedTopics();
    return unsub;
  }, [navigation]);

  const loadCompletedTopics = async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        setCompletedTopics(new Set());
        return;
      }

      const db = await getDBConnection();

      // create tracking table if missing
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
        `SELECT topic FROM topic_attempts WHERE user_id = ? AND subject = ?;`,
        [user.id, SUBJECT_NAME]
      );

      const set = new Set();
      const rows = res[0].rows;
      for (let i = 0; i < rows.length; i++) {
        set.add(rows.item(i).topic);
      }
      setCompletedTopics(set);
    } catch (err) {
      console.error('loadCompletedTopics error:', err);
      setCompletedTopics(new Set());
    } finally {
      setLoading(false);
    }
  };


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
    >

      {/* ================= LOADING ================= */}
      <Show when={loading === true}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      </Show>

      <Show when={loading !== true}>

        {/* ================= HEADER ================= */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Agricultural Science
          </Text>
        </View>

        {/* ================= TITLE ================= */}
        <Text style={styles.sectionTitle}>
          Table of Contents
        </Text>

        {/* ================= TOPICS ================= */}
        <Show when={Array.isArray(agricTopics)}>
          {agricTopics.map((topic, index) => {
            const topicText = String(topic || '');
            const isCompleted =
              completedTopics instanceof Set
                ? completedTopics.has(topic)
                : false;

            const navigateTopic = () => {
              if (
                topicText.toLowerCase().includes('agric runner game')
              ) {
                navigation.navigate('AgricGame');
              } else {
                navigation.navigate('AgricLessonDetail', {
                  topicIndex: index,
                });
              }
            };

            return (
              <View
                key={`${topicText}-${index}`}
                style={styles.topicWrapper}
              >
                  <TouchableOpacity
                    style={styles.topic}
                    onPress={navigateTopic}
                  >

                  <Text style={styles.topicText}>
                    {index + 1}. {topicText}
                  </Text>
                </TouchableOpacity>

                {/* ================= META ================= */}
                <View style={styles.meta}>
                  <Show when={isCompleted === true}>
                    <TouchableOpacity onPress={navigateTopic}>
                      <Text style={styles.viewText}>View</Text>
                    </TouchableOpacity>
                  </Show>

                  <Show when={isCompleted !== true}>
                    <TouchableOpacity onPress={navigateTopic}>
                      <Text style={styles.startText}>Start</Text>
                    </TouchableOpacity>
                  </Show>
                </View>
              </View>
            );
          })}
        </Show>

      </Show>
    </ScrollView>
  );



};

export default AgricSubjectScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 18 },
  header: {
    backgroundColor: '#001F54',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 18,
  },

  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#001F54',
    marginBottom: 12,
  },
  topicWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  topic: {
    backgroundColor: '#f6f8fb',
    padding: 14,
    borderRadius: 10,
    flex: 1,
    borderLeftWidth: 6,
    borderLeftColor: '#001F54',
  },
  topicDisabled: {
    opacity: 0.6,
    backgroundColor: '#eef6ef',
  },
  topicText: { fontSize: 16, fontWeight: '600', color: '#222' },
  meta: { marginLeft: 10 },
  completedBadge: {
    color: '#2e7d32',
    fontWeight: '700',
  },
  startText: {
    color: '#001F54',
    fontWeight: '700',
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewText: {
    color: '#2e7d32',
    fontWeight: '700',
  },

});
