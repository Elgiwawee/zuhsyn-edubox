import React from 'react';
import { View, Text } from 'react-native';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('🔥 APP CRASH CAUGHT:', error, info);
  }

  render() {
    if (this.state.hasError === true) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <Text style={{ fontSize: 16, textAlign: 'center' }}>
            Something went wrong.
          </Text>
          <Text style={{ marginTop: 8, color: '#666', textAlign: 'center' }}>
            Please restart the app.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}
