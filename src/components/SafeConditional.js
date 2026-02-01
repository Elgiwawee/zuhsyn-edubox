// components/SafeConditional.js
import React from 'react';
import { Text } from 'react-native';

const isRenderable = (v) =>
  React.isValidElement(v) ||
  typeof v === 'number';

export const Show = ({ when, children }) => {
  if (!when) return null;

  if (typeof children === 'string') {
    return <Text>{children}</Text>;
  }

  if (Array.isArray(children)) {
    return (
      <>
        {children.map((c, i) =>
          typeof c === 'string' ? <Text key={i}>{c}</Text> : c
        )}
      </>
    );
  }

  return isRenderable(children) ? children : null;
};

export const Render = ({ when, fallback = null, children }) => {
  const value = when ? children : fallback;

  if (typeof value === 'string') {
    return <Text>{value}</Text>;
  }

  if (Array.isArray(value)) {
    return (
      <>
        {value.map((v, i) =>
          typeof v === 'string' ? <Text key={i}>{v}</Text> : v
        )}
      </>
    );
  }

  return isRenderable(value) ? value : null;
};
