import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LottieView from 'lottie-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Show, Render } from '../components/SafeConditional';



const RUNNER_JSON = require('../../assets/lottie/runner_base.json');

const SKIN_COLOR_MAP = {
  skin_blue: '#3F7CFF',
  skin_green: '#2ECC71',
  skin_gold: '#F4C430',
};

const SKIN_LABELS = {
  skin_blue: 'Blue Runner',
  skin_green: 'Green Runner',
  skin_gold: 'Golden Runner',
};

const colorFilters = hex => ([
  { keypath: 'Body.Fill 1', color: hex },
  { keypath: 'Leg 1.Fill 1', color: hex },
  { keypath: 'Leg 2.Fill 1', color: hex },
]);

export default function SkinPreviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const { skinKey = 'skin_blue' } = route.params || {};
  const color = SKIN_COLOR_MAP[skinKey] || SKIN_COLOR_MAP.skin_blue;
  const label = SKIN_LABELS[skinKey] || 'Runner';

  return (
    <View style={styles.container}>
      {/* TITLE */}
      <Text style={styles.title}>
        {typeof label === 'string' ? label : ''}
      </Text>

      {/* LOTTIE */}
      <Show when={RUNNER_JSON}>
        <LottieView
          source={RUNNER_JSON}
          autoPlay
          loop
          colorFilters={
            typeof colorFilters === 'function'
              ? colorFilters(color)
              : []
          }
          style={styles.lottie}
        />
      </Show>

      {/* CLOSE */}
      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigation?.goBack?.()}
      >
        <Text style={styles.btnText}>
          Close Preview
        </Text>
      </TouchableOpacity>
    </View>
  );

}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  lottie: { width: 180, height: 180 },
  btn: {
    marginTop: 30,
    backgroundColor: '#001F54',
    padding: 12,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
