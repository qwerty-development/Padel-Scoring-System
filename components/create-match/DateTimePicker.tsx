import React, { useState } from 'react';
import { 
  View, 
  TouchableOpacity, 
  Platform, 
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

import { Text } from '@/components/ui/text';
import { useColorScheme } from '@/lib/useColorScheme';

interface CustomDateTimePickerProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  mode?: 'date' | 'time' | 'datetime';
}

export function CustomDateTimePicker({
  label,
  value,
  onChange,
  maximumDate,
  minimumDate,
  mode = 'datetime'
}: CustomDateTimePickerProps) {
  const { colorScheme } = useColorScheme();
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value);

  // Format the display string based on the mode
  const getFormattedValue = () => {
    if (mode === 'date') {
      return format(value, 'MMMM d, yyyy');
    } else if (mode === 'time') {
      return format(value, 'h:mm a');
    } else {
      return format(value, 'MMMM d, yyyy h:mm a');
    }
  };

  const handleChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (selectedDate) {
      setTempDate(selectedDate);
      
      // On iOS, we'll confirm the date when the modal is closed
      if (Platform.OS === 'ios') {
        return;
      }
      
      // On Android, we'll update immediately
      onChange(selectedDate);
    }
  };

  const confirmIOSDate = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  const cancelIOSDate = () => {
    setTempDate(value);
    setShowPicker(false);
  };

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-muted-foreground mb-1">
        {label}
      </Text>
      
      <TouchableOpacity
        className="flex-row justify-between items-center p-3 border border-border rounded-lg bg-background dark:bg-background/40"
        onPress={() => setShowPicker(true)}
      >
        <Text className="text-foreground">{getFormattedValue()}</Text>
        <Ionicons 
          name={mode === 'time' ? 'time-outline' : 'calendar-outline'} 
          size={20} 
          color={colorScheme === 'dark' ? '#ddd' : '#555'} 
        />
      </TouchableOpacity>

      {/* Android uses the native date picker */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode={mode}
          display="default"
          onChange={handleChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
        />
      )}

      {/* iOS uses a modal with the date picker */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
        >
          <TouchableWithoutFeedback onPress={cancelIOSDate}>
            <View className="flex-1 justify-end bg-black/50">
              <TouchableWithoutFeedback>
                <View className="bg-card rounded-t-xl">
                  <View className="flex-row justify-between items-center p-4 border-b border-border">
                    <TouchableOpacity onPress={cancelIOSDate}>
                      <Text className="text-primary">Cancel</Text>
                    </TouchableOpacity>
                    <Text className="font-semibold">{label}</Text>
                    <TouchableOpacity onPress={confirmIOSDate}>
                      <Text className="text-primary">Done</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <DateTimePicker
                    value={tempDate}
                    mode={mode}
                    display="spinner"
                    onChange={handleChange}
                    style={{ height: 200 }}
                    maximumDate={maximumDate}
                    minimumDate={minimumDate}
                    textColor={colorScheme === 'dark' ? '#fff' : '#000'}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}