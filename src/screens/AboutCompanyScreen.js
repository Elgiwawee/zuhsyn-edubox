// screens/AboutCompanyScreen.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Show, Render } from '../components/SafeConditional';

const socialLinks = [
  { label: '🌐 Visit Our Website', url: 'https://www.zuhsyn.com.ng' },
  { label: '📘 Facebook', url: 'https://web.facebook.com/profile.php?id=61577053986342' },
  { label: '🐦 X (Twitter)', url: 'https://x.com/zuhsyn93051?t=sUTBgGWorbSqLSRs_xIS1w&s=08' },
  { label: '📷 Instagram', url: 'https://www.instagram.com/zuhsyninnovationslimited' },
  { label: '💼 LinkedIn', url: 'https://linkedin.com/company/zuhsyn-innovations-limited' },
  { label: '📧 Contact Us', url: 'mailto:contact@zuhsyn.com.ng' },
];

export default function AboutCompanyScreen() {
  const navigation = useNavigation();

  const openLink = async (url) => {
    if (typeof url !== 'string' || url.length === 0) return;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to open link');
      }
    } catch {
      Alert.alert('Something went wrong');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>About Us</Text>
        </View>

        {/* DESCRIPTION */}
        <Text style={styles.description}>
          EduBox is an innovative learning platform that provides educational
          resources, quizzes, and study materials for students of all ages.
          The application was founded and developed by Zuhsyn Innovations Limited, Zaria.
        </Text>

        <Text style={styles.description}>
          Our mission is to make learning accessible, engaging, and effective for everyone.
        </Text>

        {/* SOCIAL */}
        <Text style={styles.subtitle}>Follow Us</Text>

        <Show when={Array.isArray(socialLinks) && socialLinks.length > 0}>
          {socialLinks.map((link, index) => (
            <TouchableOpacity
              key={index}
              style={styles.linkButton}
              onPress={() => openLink(link.url)}
            >
              <Text style={styles.linkText}>{link.label}</Text>
            </TouchableOpacity>
          ))}
        </Show>
      </ScrollView>
    </SafeAreaView>
  );

}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#001F54',
    padding: 15,
    borderRadius: 12,
    marginBottom: 18,
  },

  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
  },

  description: {
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 18,
    color: '#444',
  },

  subtitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#001F54',
  },

  linkButton: {
    backgroundColor: '#f4f6f9',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
  },

  linkText: {
    fontSize: 16,
    color: '#0B74FF',
    fontWeight: '600',
  },
});
