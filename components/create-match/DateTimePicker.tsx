import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Platform,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";

import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";

interface CustomDateTimePickerProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  mode?: "date" | "time" | "datetime";
}

export function CustomDateTimePicker({
  label,
  value,
  onChange,
  maximumDate,
  minimumDate,
  mode = "datetime",
}: CustomDateTimePickerProps) {
  const { colorScheme } = useColorScheme();
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value);

  // Format the display string based on the mode
  const getFormattedValue = () => {
    if (mode === "date") {
      return format(value, "MMMM d, yyyy");
    } else if (mode === "time") {
      return format(value, "h:mm a");
    } else {
      return format(value, "MMMM d, yyyy h:mm a");
    }
  };

  // Round to nearest 30 minutes
  const roundToNearestThirtyMinutes = (date: Date): Date => {
    const roundedDate = new Date(date);
    const minutes = roundedDate.getMinutes();
    const roundedMinutes = Math.round(minutes / 30) * 30;
    
    if (roundedMinutes === 60) {
      roundedDate.setHours(roundedDate.getHours() + 1);
      roundedDate.setMinutes(0, 0, 0);
    } else {
      roundedDate.setMinutes(roundedMinutes, 0, 0);
    }
    
    return roundedDate;
  };

  const handleChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (selectedDate) {
      // Round to nearest 30 minutes for time mode
      let processedDate = selectedDate;
      if (mode === "time") {
        processedDate = roundToNearestThirtyMinutes(selectedDate);
      }
      
      setTempDate(processedDate);

      // On Android, update immediately
      if (Platform.OS === "android") {
        onChange(processedDate);
      }
    }
  };

  const confirmIOSDate = () => {
    // Round to nearest 30 minutes for time mode before confirming
    let finalDate = tempDate;
    if (mode === "time") {
      finalDate = roundToNearestThirtyMinutes(tempDate);
    }
    onChange(finalDate);
    setShowPicker(false);
  };

  const cancelIOSDate = () => {
    setTempDate(value);
    setShowPicker(false);
  };

  // Get appropriate icon based on current context
  const getIcon = () => {
    if (mode === "time") {
      return "time-outline";
    } else if (mode === "date") {
      return "calendar-outline";
    } else {
      return "calendar-outline";
    }
  };

  // Enhanced styling for better visual feedback
  const getContainerStyling = () => {
    return {
      shadowColor: "#1a7ebd",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    };
  };

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-muted-foreground mb-2">
        {label}
      </Text>

      <TouchableOpacity
        className="flex-row justify-between items-center p-4 border border-border rounded-xl bg-background dark:bg-background/40 active:bg-muted/50"
        onPress={() => setShowPicker(true)}
        style={getContainerStyling()}
        activeOpacity={0.8}
      >
        <View className="flex-1">
          <Text className="text-foreground font-medium">{getFormattedValue()}</Text>
          {mode === "time" && (
            <Text className="text-xs text-muted-foreground mt-1">
              Rounded to nearest 30 minutes
            </Text>
          )}
        </View>
        <View className="ml-3 p-2 rounded-lg bg-primary/10">
          <Ionicons
            name={getIcon()}
            size={20}
            color="#1a7ebd"
          />
        </View>
      </TouchableOpacity>

      {/* Android uses the native date picker */}
      {showPicker && Platform.OS === "android" && (
        <DateTimePicker
          value={tempDate}
          mode={mode}
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          minuteInterval={mode === "time" ? 30 : undefined}
        />
      )}

      {/* iOS uses a modal with the date picker */}
      {Platform.OS === "ios" && (
        <Modal visible={showPicker} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={cancelIOSDate}>
            <View className="flex-1 justify-end bg-black/50">
              <TouchableWithoutFeedback>
                <View className="bg-card rounded-t-xl">
                  <View className="flex-row justify-between items-center p-4 border-b border-border">
                    <TouchableOpacity 
                      onPress={cancelIOSDate}
                      className="py-2 px-3 rounded-lg"
                      activeOpacity={0.7}
                    >
                      <Text className="text-primary font-medium">Cancel</Text>
                    </TouchableOpacity>
                    <View className="flex-1 items-center">
                      <Text className="font-semibold text-lg">{label}</Text>
                      {mode === "time" && (
                        <Text className="text-xs text-muted-foreground">
                          30-minute intervals
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity 
                      onPress={confirmIOSDate}
                      className="py-2 px-3 rounded-lg bg-primary/10"
                      activeOpacity={0.7}
                    >
                      <Text className="text-primary font-semibold">Done</Text>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={tempDate}
                    mode={mode}
                    display="spinner"
                    onChange={handleChange}
                    style={{ height: 200 }}
                    minimumDate={minimumDate}
                    maximumDate={maximumDate}
                    textColor={colorScheme === "dark" ? "#fff" : "#000"}
                    minuteInterval={mode === "time" ? 30 : undefined}
                  />
                  
                  {/* Additional padding for better iOS experience */}
                  <View className="h-8" />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}