import React, { useState, useMemo } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/text";
import { H2 } from "@/components/ui/typography";
import { CourtSelectionModalProps, Court } from "@/types/create-match";
import { PREDEFINED_COURTS } from "@/constants/create-match";

export const CourtSelectionModal: React.FC<CourtSelectionModalProps> = ({
  visible,
  onClose,
  onSelectCourt,
  selectedCourt,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const regions = useMemo(() => {
    const uniqueRegions = new Set(
      PREDEFINED_COURTS.map((court) => court.region),
    );
    return Array.from(uniqueRegions).sort();
  }, []);

  const filteredCourts = useMemo(() => {
    let courts = PREDEFINED_COURTS;

    if (selectedRegion) {
      courts = courts.filter((court) => court.region === selectedRegion);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      courts = courts.filter(
        (court) =>
          court.name.toLowerCase().includes(query) ||
          court.area.toLowerCase().includes(query) ||
          court.region.toLowerCase().includes(query),
      );
    }

    return courts;
  }, [searchQuery, selectedRegion]);

  const renderCourtItem = ({ item }: { item: Court }) => {
    const isSelected = selectedCourt?.id === item.id;

    return (
      <TouchableOpacity
        className={`p-4 mb-2 rounded-xl border ${
          isSelected
            ? "bg-primary/10 border-primary"
            : "bg-card border-border/30"
        }`}
        onPress={() => {
          onSelectCourt(item);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center mb-1">
              <Text
                className={`font-semibold ${isSelected ? "text-primary" : ""}`}
              >
                {item.name}
              </Text>
              {item.type === "indoor" ? (
                <View className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                  <Text className="text-xs text-blue-700 dark:text-blue-300">
                    Indoor
                  </Text>
                </View>
              ) : (
                <View className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded">
                  <Text className="text-xs text-green-700 dark:text-green-300">
                    Outdoor
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-sm text-muted-foreground">
              {item.area} • {item.region}
            </Text>
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color="#2148ce" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50">
        <View className="flex-1 bg-background mt-20 rounded-t-3xl">
          {/* Header */}
          <View className="p-6 border-b border-border">
            <View className="flex-row items-center justify-between mb-4">
              <H2>Select Court</H2>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View className="flex-row items-center bg-muted/30 rounded-xl px-4 py-3">
              <Ionicons
                name="search"
                size={20}
                color="#666"
                style={{ marginRight: 8 }}
              />
              <TextInput
                className="flex-1 text-foreground"
                placeholder="Search courts..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Courts List */}
          <FlatList
            data={filteredCourts}
            keyExtractor={(item) => item.id}
            renderItem={renderCourtItem}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <View className="items-center justify-center py-12">
                <Ionicons name="search" size={48} color="#666" />
                <Text className="text-muted-foreground mt-2">
                  No courts found
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};
