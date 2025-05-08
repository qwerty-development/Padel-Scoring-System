import React, { useState } from 'react';
import { 
  View, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

import { Text } from '@/components/ui/text';

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
  maximumDate = new Date(),
  minimumDate,
  mode = 'datetime'
}: CustomDateTimePickerProps) {
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
    <View style={styles.container}>
      <Text className="text-sm font-medium text-muted-foreground mb-1">
        {label}
      </Text>
      
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setShowPicker(true)}
      >
        <Text className="text-foreground">{getFormattedValue()}</Text>
        <Ionicons name="calendar" size={20} color="#777" />
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
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
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
                    style={styles.iOSPicker}
                    maximumDate={maximumDate}
                    minimumDate={minimumDate}
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

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  iOSPicker: {
    height: 200,
  },
});