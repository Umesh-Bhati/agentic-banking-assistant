import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export function Icon({ name, size, color }: { name: any, size: number, color: string }) {
  const iconMap: Record<string, any> = {
    'remove': 'close',
    'stop': 'stop',
    'add': 'add',
    'copy': 'copy-outline',
    'check': 'checkmark',
    'refresh': 'refresh',
    'reload': 'refresh',
    'arrow-down': 'chevron-down',
    'arrow-up': 'chevron-up',
    'arrow-left': 'chevron-back',
    'arrow-right': 'chevron-forward',
    'chevron-left': 'chevron-back',
    'chevron-right': 'chevron-forward',
    'send': 'send',
  };
  return <Ionicons name={iconMap[name] || name} size={size} color={color} />;
}
