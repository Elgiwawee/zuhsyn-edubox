// screens/EnrollmentScreen.js
import React, { useEffect, useMemo, useRef,useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  FlatList,
  Animated,
  Easing,
  Platform,
  Keyboard,
  Alert,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DropDownPicker from 'react-native-dropdown-picker'; 
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from "../context/AuthContext";

// DB helpers - adapt path if needed
import {
  getUserPieces,
  piecesToNaira,
  enrollInSubject,
  getUserEnrollments,
} from '../utils/dbHelper';
import { getDBConnection } from '../utils/database';
import { Show, Render } from '../components/SafeConditional';


// animation constants
const ANIM_DURATION = 320;
const NAIRA_PER_PIECE = 8.3;
const EnrollmentScreen = () => {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);

  // UI state
  const [trackOpen, setTrackOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const [track, setTrack] = useState(null);
  const [category, setCategory] = useState(null);

  // data loading
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);

  const [subjects, setSubjects] = useState([]); // fetched subjects for selected track+category
  const [filteredSubjects, setFilteredSubjects] = useState([]); // search filtered

  // pieces / user
  const [userPieces, setUserPieces] = useState(0);
  const [loadingPieces, setLoadingPieces] = useState(true);

  // search
  const [search, setSearch] = useState('');
  const searchTimer = useRef(null);

  const isEnrolled = (subjectName) => {
  return enrolledSubjects.includes(subjectName);
};



  // header animation
  const headerAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef({}); // map id -> Animated.Value

  // TRACKS & CATEGORIES configuration (central place; easy to extend)
  const TRACKS = useMemo(() => ({
    "O'Level Track": { key: 'OLevel', categories: ['JAMB', 'WAEC', 'NECO', 'NABTEB', 'NBAIS'] },
    "A'Level Track": { key: 'ALevel', categories: ['Level 1', 'Level 2', 'Level 3', 'Level 4'] },
    "Skills Track": { key: 'Skills', categories: [ 'Python Programming Language', 'HTML & CSS', 'JavaScript', 'MS Excel', 'MS Word', 'MS PowerPoint', 'MS Access' ] },
    "Career Track": { key: 'Career', categories: [ 'Data Analysis', 'Web Development', 'Cybersecurity', 'Ethical Hacking', 'AI Engineering', 'ML Engineering', 'Software Engineering', 'Software Development' ] },
  }), []);

  // Derived lists for dropdowns
  const trackItems = useMemo(() => Object.keys(TRACKS).map(t => ({ label: t, value: t })), [TRACKS]);
  const categoryItems = useMemo(() => {
    if (!track) return [];
    const cats = TRACKS[track].categories || [];
    return cats.map(c => ({ label: c, value: c }));
  }, [track, TRACKS]);

  const refreshPieces = async () => {
  try {
    const pcs = await getUserPieces();
    setUserPieces(pcs || 0);
  } catch (e) {
    console.warn("Failed to refresh pieces", e);
  }
};

  useEffect(() => {
  const loadEnrollments = async () => {
    if (!user?.id) return;

    const enrolls = await getUserEnrollments(user.id);
    setEnrolledSubjects(enrolls.map(e => e.subject_name));
  };

  loadEnrollments();
}, [user]);

// load pieces only after user.id is available
useEffect(() => {
  if (!user?.id) return;  // wait for the logged-in user
  
  let mounted = true;
  setLoadingPieces(true);

  (async () => {
    try {
      const pcs = await getUserPieces(user.id); // make sure ID is passed
      if (mounted) setUserPieces(pcs || 0);
    } catch (e) {
      console.warn("Enrollment: getUserPieces failed", e);
    } finally {
      if (mounted) setLoadingPieces(false);
    }
  })();

  // play header animation
  Animated.timing(headerAnim, {
    toValue: 1,
    duration: 420,
    easing: Easing.out(Easing.ease),
    useNativeDriver: true,
  }).start();

  return () => { mounted = false; };
}, [user?.id]); // 🔥 ONLY re-run when user.id becomes available


  // whenever category changes -> fetch subjects from local DB
  useEffect(() => {
    let mounted = true;
    setSubjects([]);
    setFilteredSubjects([]);
    if (!category) return;

    (async () => {
      setLoadingSubjects(true);
      try {
        const db = await getDBConnection();
        // We stored track/category as simple strings in subjects.track and subjects.category
        const trackKey = TRACKS[track]?.key ?? track ?? '';
        const cat = category;
        const q = `SELECT id, name, description, price AS price_in_currency, is_free, track, category
                   FROM subjects
                   WHERE track = ? AND category = ?
                   ORDER BY name COLLATE NOCASE`;
        const res = await db.executeSql(q, [trackKey || track, cat]);
        // rowsToArray helper isn't available here; parse native result
        const rows = [];
        if (res && res[0] && res[0].rows) {
          for (let i = 0; i < res[0].rows.length; i++) {
            rows.push(res[0].rows.item(i));
          }
        }
        const normalized = (rows || []).map(r => {
          const priceNaira = Number(r.price_in_currency || 0); // price stored in DB in Naira
          const piece_cost = priceNaira > 0 ? Math.ceil(priceNaira / NAIRA_PER_PIECE) : 0;

          return {
            id: r.id,
            name: r.name,
            description: r.description,
            price_naira: priceNaira,        // keep explicit Naira value
            piece_cost,                     // computed pieces needed to unlock
            is_free: r.is_free === 1 || r.is_free === '1',
            raw: r,
          };
        });

        if (!mounted) return;
        // set animations values for each id
        normalized.forEach(it => { itemAnims.current[it.id] = new Animated.Value(0); });
        setSubjects(normalized);
        setFilteredSubjects(normalized);
        // stagger reveal
        Animated.stagger(70, normalized.map(it => Animated.timing(itemAnims.current[it.id], { toValue: 1, duration: ANIM_DURATION, easing: Easing.out(Easing.ease), useNativeDriver: true }))).start();
      } catch (e) {
        console.warn('Enrollment: fetch subjects failed', e);
        setSubjects([]);
        setFilteredSubjects([]);
      } finally {
        if (mounted) setLoadingSubjects(false);
      }
    })();

    return () => { mounted = false; };
  }, [category, track, TRACKS]);

  // search debounce
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const q = (search || '').trim().toLowerCase();
      if (!q) {
        setFilteredSubjects(subjects);
        return;
      }
      setFilteredSubjects(subjects.filter(s => (s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)));
    }, 260);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, subjects]);

  // Helpers
  const convertPiecesToNaira = (pieces) => {
    try {
      if (typeof piecesToNaira === 'function') return piecesToNaira(pieces);
    } catch (e) { /* ignore */ }
    // fallback rate 1 piece = 8.3 Naira
    return Math.round((pieces || 0) * 8.3);
  };

  const canEnrollWithPieces = (pieceCost) => {
    if (!pieceCost || Number(pieceCost) === 0) return true;
    return (userPieces || 0) >= Number(pieceCost);
  };

  // enrollment actions
  const handleEnrollWithPieces = async (subject) => {
    try {
      const res = await enrollInSubject(user.id, subject.name, {
        paymentMethod: 'pieces'
      });

      // 🔥 REFRESH ENROLLED SUBJECTS
      const enrolls = await getUserEnrollments(user.id);
      setEnrolledSubjects(enrolls.map(e => e.subject_name));

      await refreshPieces();  

      Alert.alert(
        "Enrolled",
        `${subject.name} unlocked using pieces.`
      );
    } catch (e) {
      console.error("Enroll using pieces failed:", e);
      Alert.alert("Error", "Could not enroll using pieces.");
    }
  };


  const handleFreeEnroll = async (subject) => {
    try {
      const res = await enrollInSubject(user.id, subject.name, {
        paymentMethod: 'free'
      });

      // 🔥 REFRESH ENROLLED SUBJECTS
      const enrolls = await getUserEnrollments(user.id);
      setEnrolledSubjects(enrolls.map(e => e.subject_name));

      Alert.alert("Enrolled", `${subject.name} enrolled for free.`);
    } catch (e) {
      console.error("Free enroll error:", e);
      Alert.alert("Error", "Could not enroll for free.");
    }
  };



  const handleEnrollWithPayment = (subject) => {
    // navigate to PaymentMethod with subject detail and return to Enrollment after payment completed
    navigation.navigate('PaymentMethod', { subject });
  };

  const renderItem = ({ item }) => {
  const name = String(item?.name ?? '');
  const description =
    typeof item?.description === 'string'
      ? item.description
      : '';

  const isFree = Boolean(item?.is_free);
  const priceNaira = Number(item?.price_naira || 0);
  const pieceCost = Number(item?.piece_cost || 0);

  const enrolled = isEnrolled(name);
  const enough = canEnrollWithPieces(pieceCost);

  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{name}</Text>

        {description.length > 0 && (
          <Text style={styles.subtitle}>{description}</Text>
        )}

        <Text style={styles.meta}>
          {isFree
            ? 'Free'
            : `₦${priceNaira} • ${pieceCost} pcs`}
        </Text>
      </View>

      <View style={{ marginLeft: 8 }}>
        {enrolled === true && (
          <View style={[styles.btn, { backgroundColor: '#ccc' }]}>
            <Text style={[styles.btnText, { color: '#555' }]}>
              Enrolled
            </Text>
          </View>
        )}

        {enrolled !== true && isFree === true && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#00C851' }]}
            onPress={() => handleFreeEnroll(item)}
          >
            <Text style={styles.btnText}>
              Enroll (Free)
            </Text>
          </TouchableOpacity>
        )}

        {enrolled !== true && isFree !== true && enough === true && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#001F54' }]}
            onPress={() => handleEnrollWithPieces(item)}
          >
            <Text style={styles.btnText}>
              Unlock (Use pieces)
            </Text>
          </TouchableOpacity>
        )}

        {enrolled !== true && isFree !== true && enough !== true && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#0B74FF' }]}
            onPress={() => handleEnrollWithPayment(item)}
          >
            <Text style={styles.btnText}>
              Pay to unlock
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};



  return (
    <SafeAreaView style={styles.screen}>

      {/* ================= HEADER ================= */}
      <Animated.View
        style={[
          styles.header,
          {
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-28, 0],
                }),
              },
            ],
            opacity: headerAnim,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Icon name="arrow-left" size={20} color="#001F54" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Enroll in Subjects
        </Text>

        <View style={{ width: 36 }} />
      </Animated.View>

      <View style={styles.container}>

        {/* ================= TRACK ================= */}
        <View style={{ marginBottom: 12 }}>
          <DropDownPicker
            open={trackOpen}
            value={track}
            items={trackItems}
            setOpen={setTrackOpen}
            setValue={(val) => {
              setTrack(val());
              setCategory(null);
              setSubjects([]);
              setFilteredSubjects([]);
              Keyboard.dismiss();
            }}
            placeholder="Select Track"
            zIndex={3000}
            listMode="SCROLLVIEW"
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropDownContainer}
          />
        </View>

        {/* ================= CATEGORY ================= */}
        <Show when={typeof track === 'string'}>
          <View style={{ marginBottom: 12, zIndex: 2000 }}>
            <DropDownPicker
              open={Boolean(categoryOpen)}
              value={category ?? null}
              items={Array.isArray(categoryItems) ? categoryItems : []}
              setOpen={setCategoryOpen}
              setValue={(cb) => {
                const next =
                  typeof cb === 'function' ? cb(category) : cb;
                setCategory(next ?? null);
                setSearch('');
                Keyboard.dismiss();
              }}
              placeholder="Select Category"
              zIndex={2000}
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropDownContainer}
            />
          </View>
        </Show>

        {/* ================= PIECES + SEARCH ================= */}
        <View style={styles.piecesRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.piecesLabel}>
              Pieces:{' '}
              <Text style={{ fontWeight: '800' }}>
                {loadingPieces === true
                  ? '...'
                  : String(userPieces ?? 0)}
              </Text>
            </Text>

            <Text style={styles.piecesSub}>
              ₦
              {typeof convertPiecesToNaira === 'function'
                ? convertPiecesToNaira(Number(userPieces) || 0)
                : 0}
            </Text>
          </View>

          <View style={{ width: 200 }}>
            <View style={styles.search}>
              <Icon name="magnify" size={18} color="#666" />

              <TextInput
                placeholder="Search subjects..."
                value={typeof search === 'string' ? search : ''}
                onChangeText={setSearch}
                style={styles.searchInput}
              />

              <Show when={typeof search === 'string' && search.length > 0}>
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Icon name="close-circle" size={18} color="#666" />
                </TouchableOpacity>
              </Show>
            </View>
          </View>
        </View>

        {/* ================= SUBJECT LIST ================= */}
        <View style={{ flex: 1, marginTop: 6 }}>

          <Show when={loadingSubjects === true}>
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#001F54" />
              <Text style={{ marginTop: 10, color: '#666' }}>
                Loading subjects…
              </Text>
            </View>
          </Show>

          <Show
            when={
              loadingSubjects !== true &&
              (!category || category.length === 0)
            }
          >
            <View style={styles.empty}>
              <Text style={{ color: '#666' }}>
                Select a category to show subjects
              </Text>
            </View>
          </Show>

          <Show
            when={
              loadingSubjects !== true &&
              Array.isArray(filteredSubjects) &&
              filteredSubjects.length === 0
            }
          >
            <View style={styles.empty}>
              <Text style={{ color: '#666' }}>
                No subjects found
              </Text>
            </View>
          </Show>

          <Show
            when={
              loadingSubjects !== true &&
              Array.isArray(filteredSubjects) &&
              filteredSubjects.length > 0
            }
          >
            <FlatList
              data={filteredSubjects}
              keyExtractor={(i) => String(i?.id ?? Math.random())}
              renderItem={renderItem}
              contentContainerStyle={{
                paddingBottom: 40,
                paddingTop: 8,
              }}
              showsVerticalScrollIndicator={false}
            />
          </Show>

        </View>
      </View>
    </SafeAreaView>
  );


};

export default EnrollmentScreen;

// styles
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingTop: Platform.OS === 'ios' ? 36 : 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#001F54' },

  container: { flex: 1, padding: 16 },

  dropdown: { borderRadius: 10, height: 48, borderColor: '#E6EEF6' },
  dropDownContainer: { borderRadius: 10 },

  piecesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  piecesLabel: { fontSize: 14, color: '#222' },
  piecesSub: { fontSize: 12, color: '#666', marginTop: 2 },

  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F6F8', paddingHorizontal: 10, borderRadius: 10, height: 44 },
  searchInput: { marginLeft: 8, flex: 1, height: 44 },

  loading: { alignItems: 'center', marginTop: 40 },
  empty: { alignItems: 'center', marginTop: 40 },

  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#0B2545' },
  subtitle: { color: '#6B7280', marginTop: 6 },
  meta: { marginTop: 6, color: '#69707A' },

  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: '700' },
});
