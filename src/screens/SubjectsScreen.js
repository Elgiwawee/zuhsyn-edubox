// screens/SubjectsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import HeaderTitle from '../components/HeaderTitle';
import { getDBConnection } from '../utils/database';
import { getCurrentUser } from '../utils/dbHelper';
import { Show, Render } from '../components/SafeConditional';


const SubjectsScreen = () => {
  const navigation = useNavigation();

  const [expiredSubjects, setExpiredSubjects] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  /** -------------------------------
   * LOAD ENROLLED SUBJECTS
   * ------------------------------- */
  const loadEnrolledSubjects = async () => {
      try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
          console.log('⚠️ No logged-in user found.');
          setSubjects([]);
          setLoading(false);
          return;
        }

        setUser(currentUser);

        const db = await getDBConnection();
        const results = await db.executeSql(
          `SELECT id, subject_name, expiry_date 
          FROM enrollments 
          WHERE user_id = ?;`,
          [currentUser.id]
        );

        const active = [];
        const expired = [];
        const now = new Date();

        for (let i = 0; i < results[0].rows.length; i++) {
          const row = results[0].rows.item(i);

          if (!row.expiry_date || new Date(row.expiry_date) > now) {
            active.push({ name: row.subject_name, expired: false });
          } else {
            expired.push({
              id: row.id,
              name: row.subject_name,
              expired: true,
              expiry_date: row.expiry_date,
            });
          }
        }

        // Auto-clean expired subjects
        for (const ex of expired) {
          await db.executeSql(`DELETE FROM enrollments WHERE id = ?`, [ex.id]);
        }

        setSubjects(active);
        setExpiredSubjects(expired);
      } catch (err) {
        console.error('❌ Error loading subjects:', err);
        setSubjects([]);
      } finally {
        setLoading(false);
      }
    };

    useFocusEffect(
      useCallback(() => {
        setLoading(true);
        loadEnrolledSubjects();
      }, [])
    );


  /** -------------------------------
   * HANDLE SUBJECT PRESS
   * ------------------------------- */
  const handleSubjectPress = async (subjectName) => {
    try {
      const db = await getDBConnection();
      const tableName = `${subjectName.replace(/\s+/g, '_').toLowerCase()}_lessons`;

      // ✅ Check if local lessons exist
      const results = await db.executeSql(`SELECT COUNT(*) as count FROM ${tableName}`);
      const count = results[0].rows.item(0).count;

      if (count > 0) {
        navigateToSubject(subjectName);
      } else {
        Alert.alert(
          'No Offline Lessons',
          `No saved lessons for ${subjectName}. You need internet to view them.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go Online', onPress: () => navigateToSubject(subjectName) },
          ]
        );
      }
    } catch (err) {
      console.error('Error checking lessons:', err);
      navigateToSubject(subjectName);
    }
  };

  /** -------------------------------
   * SUBJECT NAVIGATION MAP
   * ------------------------------- */
  const navigateToSubject = (subject) => {
    const screenMap = {
      Maths: 'MathsSubject',
      English: 'EnglishSubject',
      Chemistry: 'ChemistrySubject',
      Biology: 'BiologySubject',
      Physics: 'PhysicsSubject',
      Agriculture: 'AgricSubject',
    };

    navigation.navigate(screenMap[subject] || 'Subjects');
  };

/** -------------------------------
 * LOADING UI
 * ------------------------------- */
if (loading === true) {
  return (
    <View
      style={[
        styles.container,
        { justifyContent: 'center', alignItems: 'center' },
      ]}
    >
      <ActivityIndicator size="large" color="#001F54" />
    </View>
  );
}

/** -------------------------------
 * MAIN UI
 * ------------------------------- */
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Show when={true}>
          <HeaderTitle />
        </Show>

        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.screenTitle}>
        {'Your Enrolled Courses'}
      </Text>

      {/* ACTIVE SUBJECTS */}
      <Render
        when={Array.isArray(subjects)}
        fallback={<View />}
      >
        <Render
          when={subjects.length === 0}
          fallback={
            <FlatList
              data={subjects}
              numColumns={2}
              keyExtractor={(item, index) =>
                String(item?.name ?? item ?? index)
              }
              renderItem={({ item }) => {
                const name = String(item?.name ?? item ?? '');
                return (
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() => handleSubjectPress(name)}
                  >
                    <Text style={styles.text}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          }
        >
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {'You haven’t enrolled in any Courses yet.'}
            </Text>

            <TouchableOpacity
              style={styles.enrollButton}
              onPress={() => navigation.navigate('Dashboard')}
            >
              <Text style={styles.enrollButtonText}>
                {'Go to Dashboard'}
              </Text>
            </TouchableOpacity>
          </View>
        </Render>
      </Render>

      {/* EXPIRED SUBJECTS */}
      <Show
        when={Array.isArray(expiredSubjects) && expiredSubjects.length > 0}
      >
        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#B00020',
              marginBottom: 10,
            }}
          >
            {'Expired Courses'}
          </Text>

          <FlatList
            data={expiredSubjects}
            numColumns={2}
            keyExtractor={(item, index) =>
              String(item?.id ?? index)
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: '#FFF1F1',
                    borderColor: '#B00020',
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[styles.text, { color: '#B00020' }]}>
                  {String(item?.name ?? '')}
                </Text>

                <Text
                  style={{
                    color: '#B00020',
                    fontSize: 12,
                    marginTop: 5,
                  }}
                >
                  {'Expired'}
                </Text>
              </View>
            )}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
          />
        </View>
      </Show>
    </View>
  );


};

export default SubjectsScreen;

/** -------------------------------
 * STYLES
 * ------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },

  header: {
    backgroundColor: '#001F54',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },

  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#001F54',
    marginBottom: 20,
    marginTop: 10,
    marginLeft: 5,
  },

  card: {
    backgroundColor: '#001F54',
    paddingVertical: 35,
    borderRadius: 10,
    marginBottom: 25,
    width: '47%',
    justifyContent: 'center',
  },

  text: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },

  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },

  emptyText: {
    color: '#444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },

  enrollButton: {
    backgroundColor: '#001F54',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },

  enrollButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
