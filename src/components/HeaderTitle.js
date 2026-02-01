// components/HeaderTitle.js
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const HeaderTitle = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/logo.jpeg')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>ZUHSYN EDUBOX</Text>
    </View>
  );
};

export default React.memo(HeaderTitle);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 180,
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 8,
    borderRadius: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
