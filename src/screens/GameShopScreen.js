import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { getDBConnection } from '../utils/database';
import { getCurrentUser } from '../utils/dbHelper';
import { Show, Render } from '../components/SafeConditional';


const SUBJECT = 'agric';

export default function GameShopScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [owned, setOwned] = useState(new Set());
  const [coins, setCoins] = useState(0);
  const [equipped, setEquipped] = useState(null);

  const userRef = useRef(null);

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Sign in required', 'Please sign in to access the shop.');
        navigation.goBack();
        return;
      }

      userRef.current = user;
      await ensureTables();
      await seedShopIfNeeded();
      await refresh();
    })();
  }, []);

  /* ---------------- DB ---------------- */
  const ensureTables = async () => {
    const db = await getDBConnection();

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS shop_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        title TEXT,
        price INTEGER
      );
    `);

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS user_game_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        asset_key TEXT,
        title TEXT,
        created_at TEXT
      );
    `);

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS equipped_skins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        asset_key TEXT,
        equipped_at TEXT
      );
    `);
  };

  const seedShopIfNeeded = async () => {
    const db = await getDBConnection();

    const defaults = [
      { key: 'skin_blue', title: 'Blue Runner Skin', price: 30 },
      { key: 'skin_green', title: 'Green Runner Skin', price: 45 },
      { key: 'skin_gold', title: 'Golden Runner Skin', price: 90 },
    ];

    for (const it of defaults) {
      await db.executeSql(
        `INSERT OR IGNORE INTO shop_items (key, title, price) VALUES (?, ?, ?)`,
        [it.key, it.title, it.price]
      );
    }
  };

  /* ---------------- LOAD ---------------- */
  const refresh = async () => {
    const db = await getDBConnection();

    // Shop items
    const res = await db.executeSql(
      `SELECT * FROM shop_items ORDER BY price ASC`
    );
    const list = [];
    for (let i = 0; i < res[0].rows.length; i++) {
      list.push(res[0].rows.item(i));
    }
    setItems(list);

    // Owned assets
    const ownedRes = await db.executeSql(
      `SELECT asset_key FROM user_game_assets WHERE user_id = ?`,
      [userRef.current.id]
    );
    const ownedSet = new Set();
    for (let i = 0; i < ownedRes[0].rows.length; i++) {
      ownedSet.add(ownedRes[0].rows.item(i).asset_key);
    }
    setOwned(ownedSet);

    // Coins
    const prog = await db.executeSql(
      `SELECT coins FROM user_game_progress WHERE user_id = ? AND subject = ? LIMIT 1`,
      [userRef.current.id, SUBJECT]
    );
    if (prog[0].rows.length) {
      setCoins(prog[0].rows.item(0).coins || 0);
    }

    // Equipped skin
    const eq = await db.executeSql(
      `SELECT asset_key FROM equipped_skins WHERE user_id = ? LIMIT 1`,
      [userRef.current.id]
    );
    setEquipped(eq[0].rows.length ? eq[0].rows.item(0).asset_key : null);
  };

  /* ---------------- ACTIONS ---------------- */
  const buyItem = async item => {
    if (owned.has(item.key)) {
      Alert.alert('Already owned', 'You already own this skin.');
      return;
    }

    if (coins < item.price) {
      Alert.alert(
        'Not enough coins',
        `You need ${item.price} coins but only have ${coins}.`
      );
      return;
    }

    const db = await getDBConnection();
    const now = new Date().toISOString();

    await db.executeSql(
      `INSERT INTO user_game_assets (user_id, asset_key, title, created_at)
       VALUES (?, ?, ?, ?)`,
      [userRef.current.id, item.key, item.title, now]
    );

    await db.executeSql(
      `UPDATE user_game_progress SET coins = coins - ? WHERE user_id = ? AND subject = ?`,
      [item.price, userRef.current.id, SUBJECT]
    );

    Alert.alert('Purchased', `${item.title} unlocked!`);
    await refresh();
  };

  const equipItem = async key => {
    if (!owned.has(key)) {
      Alert.alert('Not owned', 'Buy this skin first.');
      return;
    }

    const db = await getDBConnection();
    const now = new Date().toISOString();

    await db.executeSql(
      `DELETE FROM equipped_skins WHERE user_id = ?`,
      [userRef.current.id]
    );

    await db.executeSql(
      `INSERT INTO equipped_skins (user_id, asset_key, equipped_at)
       VALUES (?, ?, ?)`,
      [userRef.current.id, key, now]
    );

    setEquipped(key);
    Alert.alert('Equipped', 'Skin applied!');
  };

  const previewSkin = key => {
    navigation.navigate('SkinPreview', { skinKey: key });
  };

  /* ================= ITEM RENDER ================= */
  const renderItem = ({ item }) => {
    if (!item) return null;

    const itemKey = String(item?.key ?? '');
    const title = String(item?.title ?? '');
    const price = Number(item?.price) || 0;

    const owned = Boolean(isOwned);
    const equipped = Boolean(isEquipped);

    return (
      <View style={styles.itemRow}>
        {/* LEFT */}
        <View>
          <Text style={styles.itemTitle}>
            {title}
          </Text>

          <Text style={styles.itemPrice}>
            {price} coins
          </Text>

          <TouchableOpacity
            style={styles.previewBtn}
            onPress={() => previewSkin?.(itemKey)}
          >
            <Text style={styles.previewText}>Preview</Text>
          </TouchableOpacity>
        </View>

        {/* RIGHT */}
        <View>
          {/* NOT OWNED */}
          <Show when={owned === false}>
            <TouchableOpacity
              style={styles.buyBtn}
              onPress={() => buyItem?.(item)}
            >
              <Text style={styles.btnText}>Buy</Text>
            </TouchableOpacity>
          </Show>

          {/* OWNED */}
          <Show when={owned === true}>
            <TouchableOpacity
              style={[
                styles.equipBtn,
                equipped === true ? { backgroundColor: '#4CAF50' } : null,
              ]}
              onPress={() => equipItem?.(itemKey)}
            >
              <Text style={styles.btnText}>
                {equipped === true ? 'Equipped' : 'Equip'}
              </Text>
            </TouchableOpacity>
          </Show>
        </View>
      </View>
    );
  };


  /* ================= MAIN UI ================= */
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Text style={{ color: '#fff' }}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Game Shop</Text>

        <Text style={{ color: '#fff' }}>
          Coins: <Render value={coins}>{v => Number(v) || 0}</Render>
        </Text>
      </View>

      {/* LIST */}
      <FlatList
        data={Array.isArray(items) ? items : []}
        keyExtractor={(i, index) =>
          String(i?.key ?? `item-${index}`)
        }
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 40 }}>
            No items available
          </Text>
        }
      />
    </View>
  );


}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#001F54',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontWeight: '700' },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f6f8fb',
    marginBottom: 10,
    borderRadius: 10,
  },
  itemTitle: { fontWeight: '700' },
  itemPrice: { color: '#555', marginVertical: 4 },
  previewBtn: {
    marginTop: 6,
    backgroundColor: '#eee',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewText: { fontSize: 12, fontWeight: '600' },
  buyBtn: {
    backgroundColor: '#001F54',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  equipBtn: {
    backgroundColor: '#001F54',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
