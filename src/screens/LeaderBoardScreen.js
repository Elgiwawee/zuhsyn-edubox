// screens/LeaderboardScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Colors from '../constants/colors';
import { getLeaderboardAdvanced } from '../utils/dbHelper';
import { Show, Render } from '../components/SafeConditional';


const LeaderboardScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // route params may contain subjectId (string) if opened from a lesson/subject
  const routeSubject = route?.params?.subjectId ?? null;

  const [leaders, setLeaders] = useState([]);
  const [mode, setMode] = useState(routeSubject ? 'subject' : 'overall'); // overall | subject
  const [subject, setSubject] = useState(routeSubject); // use 'subject' name to match dbHelper
  const [period, setPeriod] = useState('allTime'); // allTime | daily | weekly | monthly
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchLeaders(true);
    // reset animation value whenever leaders refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, subject, period]);

  useEffect(() => {
    // when page changes (load more), fetch more and append
    if (page === 1) return;
    fetchLeaders(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchLeaders = async (reset = true) => {
    try {
      setLoading(true);
      // getLeaderboardAdvanced expects: { mode, subject, period, page, pageSize }
      const results = await getLeaderboardAdvanced({
        mode,
        subject,
        period,
        page,
        pageSize,
      });

      if (reset) {
        setLeaders(results);
      } else {
        setLeaders((prev) => [...prev, ...results]);
      }

      // animate
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error('❌ Leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankTitle = (rank) => {
    if (rank === 1) return '👑 Grand Champion';
    if (rank === 2) return '🥈 Elite Master';
    if (rank === 3) return '🥉 Bronze Warrior';
    if (rank <= 10) return '🏆 Top Performer';
    if (rank <= 25) return '🔥 Rising Hero';
    if (rank <= 50) return '📘 Dedicated Learner';
    return '🌱 Beginner Explorer';
  };

  const getMedal = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  const renderLeader = ({ item, index }) => {
    const rank = index + 1;
    return (
      <Animated.View style={[styles.row, { opacity: fadeAnim }]}>
        <Text style={styles.rank}>
          {rank} {getMedal(rank)}
        </Text>

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.username}</Text>
          <Text style={styles.badge}>{getRankTitle(rank)}</Text>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${item.accuracy}%` }]} />
          </View>
          <Text style={styles.accuracy}>Accuracy: {item.accuracy}%</Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.points}>{item.points}</Text>
          <Text style={styles.quizCount}>{item.quiz_count} quizzes</Text>
        </View>
      </Animated.View>
    );
  };

  const onSwitchToOverall = () => {
    setMode('overall');
    setSubject(null);
    setPage(1);
  };

  const onSwitchToSubject = () => {
    // If route provided a subject, keep it; otherwise you can prompt/choose later
    if (!subject) {
      // fallback — set subject to null and keep mode subject (no data)
      setSubject(null);
    }
    setMode('subject');
    setPage(1);
  };

  const onSelectPeriod = (p) => {
    // convert friendly values if needed; we use exact dbHelper values
    setPeriod(p);
    setPage(1);
  };

  const loadMore = () => {
    setPage((prev) => prev + 1);
  };

  return (
    <View style={styles.container}>
      {/* ================= HEADER ================= */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>

        <Text style={styles.header}>
          Leaderboard
        </Text>
      </View>

      {/* ================= FILTER ROW ================= */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterBtn,
            mode === 'overall' ? styles.activeFilter : null,
          ]}
          onPress={onSwitchToOverall}
        >
          <Text
            style={[
              styles.filterText,
              mode === 'overall' ? styles.activeFilterText : null,
            ]}
          >
            Overall
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterBtn,
            mode === 'subject' ? styles.activeFilter : null,
          ]}
          onPress={onSwitchToSubject}
        >
          <Text
            style={[
              styles.filterText,
              mode === 'subject' ? styles.activeFilterText : null,
            ]}
          >
            Subject
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterBtn,
            period === 'weekly' ? styles.activeFilter : null,
          ]}
          onPress={() => onSelectPeriod?.('weekly')}
        >
          <Text
            style={[
              styles.filterText,
              period === 'weekly' ? styles.activeFilterText : null,
            ]}
          >
            Weekly
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterBtn,
            period === 'monthly' ? styles.activeFilter : null,
          ]}
          onPress={() => onSelectPeriod?.('monthly')}
        >
          <Text
            style={[
              styles.filterText,
              period === 'monthly' ? styles.activeFilterText : null,
            ]}
          >
            Monthly
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterBtn,
            period === 'allTime' ? styles.activeFilter : null,
          ]}
          onPress={() => onSelectPeriod?.('allTime')}
        >
          <Text
            style={[
              styles.filterText,
              period === 'allTime' ? styles.activeFilterText : null,
            ]}
          >
            All-time
          </Text>
        </TouchableOpacity>
      </View>

      {/* ================= SUBJECT NAME ================= */}
      <Show when={mode === 'subject'}>
        <Text style={styles.subjectName}>
          <Render value={subject}>
            {(v) => `${String(v ?? 'All Subjects')} 📘`}
          </Render>
        </Text>
      </Show>

      {/* ================= LEADERBOARD ================= */}
      <Show when={loading === true}>
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={{ marginTop: 20 }}
        />
      </Show>

      <Show when={loading !== true && (!Array.isArray(leaders) || leaders.length === 0)}>
        <Text style={styles.empty}>
          No leaderboard data yet 🏆
        </Text>
      </Show>

      <Show when={loading !== true && Array.isArray(leaders) && leaders.length > 0}>
        <FlatList
          data={leaders}
          keyExtractor={(item, index) =>
            String(item?.username ?? `user-${index}`)
          }
          renderItem={renderLeader}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </Show>

      {/* ================= LOAD MORE ================= */}
      <Show when={typeof loadMore === 'function'}>
        <TouchableOpacity
          style={styles.loadMoreBtn}
          onPress={loadMore}
        >
          <Text style={styles.loadMoreText}>
            Load More ↓
          </Text>
        </TouchableOpacity>
      </Show>
    </View>
  );

};

export default LeaderboardScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },

  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backBtn: { fontSize: 28, marginRight: 10, color: Colors.primary },
  header: { fontSize: 24, fontWeight: 'bold', color: Colors.primary },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 10,
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
  },
  activeFilter: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    color: '#000',
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#fff',
  },

  subjectName: {
    fontSize: 18,
    marginBottom: 10,
    color: Colors.secondary,
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    backgroundColor: '#fafafa',
    padding: 14,
    borderRadius: 12,
    elevation: 3,
    marginBottom: 12,
  },

  rank: { fontSize: 20, fontWeight: 'bold', color: Colors.primary, width: 48 },

  name: { fontSize: 17, fontWeight: '600' },
  badge: { fontSize: 12, color: Colors.secondary },

  progressBar: {
    height: 6,
    width: '90%',
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    marginTop: 6,
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
  },
  accuracy: { fontSize: 11, marginTop: 3, color: '#777' },

  points: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  quizCount: {
    fontSize: 12,
    color: '#666',
  },

  empty: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#444',
  },

  loadMoreBtn: {
    marginTop: 20,
    alignItems: 'center',
    backgroundColor: '#eee',
    padding: 10,
    borderRadius: 8,
  },

  loadMoreText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
});
