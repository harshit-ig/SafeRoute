import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing, Shadows } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient' ;

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 16, fontSize: FontSize.sm },
    md: { paddingVertical: 14, paddingHorizontal: 24, fontSize: FontSize.md },
    lg: { paddingVertical: 18, paddingHorizontal: 32, fontSize: FontSize.lg },
  };

  const variantStyles: Record<string, { bg: string; text: string; border?: string }> = {
    primary: { bg: Colors.primary, text: Colors.white },
    secondary: { bg: Colors.dark.surfaceLight, text: Colors.white },
    outline: { bg: 'transparent', text: Colors.primary, border: Colors.primary },
    danger: { bg: Colors.dangerRed, text: Colors.white },
    ghost: { bg: 'transparent', text: Colors.primary },
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.button,
        {
          backgroundColor: v.bg,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          borderWidth: v.border ? 1.5 : 0,
          borderColor: v.border || 'transparent',
          opacity: isDisabled ? 0.5 : 1,
        },
        fullWidth && { width: '100%' },
        variant === 'primary' && Shadows.md,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              { color: v.text, fontSize: s.fontSize },
              icon ? { marginLeft: 8 } : {},
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  text: {
    fontWeight: FontWeight.semibold,
  },
});
