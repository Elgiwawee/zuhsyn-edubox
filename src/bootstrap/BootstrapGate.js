import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Button } from 'react-native';
import { safeInitDB } from '../utils/dbHelper';

export default function BootstrapGate({ children }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const init = async () => {
    setFailed(false);
    const ok = await safeInitDB();
    if (ok) setReady(true);
    else setFailed(true);
  };

  useEffect(() => {
    init();
  }, []);

  if (!ready && !failed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Initializing app…</Text>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>⚠️ Failed to initialize database</Text>
        <Button title="Retry" onPress={init} />
      </View>
    );
  }

  return children;
}
