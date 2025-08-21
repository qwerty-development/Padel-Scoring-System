// Enhanced Dynamic Greeting Generator Based on Player Performance
const generateDynamicGreeting = (): { emoji: string; message: string; color: string } => {
    if (!userStats) {
      return { emoji: "👋", message: "Welcome", color: "text-foreground" };
    }

    const { currentStreak, winRate, totalMatches, recentPerformance } = userStats;

    // Hot streak greetings (3+ wins in a row)
    if (currentStreak >= 5) {
      const fireGreetings = [
        { emoji: "🔥", message: "ON FIRE", color: "text-orange-500" },
        { emoji: "⚡", message: "UNSTOPPABLE", color: "text-yellow-500" },
        { emoji: "🚀", message: "BLAZING", color: "text-red-500" },
      ];
      return fireGreetings[Math.floor(Math.random() * fireGreetings.length)];
    }

    if (currentStreak >= 3) {
      const hotGreetings = [
        { emoji: "🏆", message: "CHAMPION", color: "text-yellow-600" },
        { emoji: "💪", message: "DOMINATING", color: "text-primary" },
        { emoji: "⭐", message: "STELLAR", color: "text-purple-600" },
      ];
      return hotGreetings[Math.floor(Math.random() * hotGreetings.length)];
    }

    // Win streak greetings (1-2 wins)
    if (currentStreak >= 1) {
      const winGreetings = [
        { emoji: "😎", message: "CRUISING", color: "text-green-600" },
        { emoji: "💯", message: "ROLLING", color: "text-blue-500" },
        { emoji: "🎯", message: "FOCUSED", color: "text-indigo-600" },
      ];
      return winGreetings[Math.floor(Math.random() * winGreetings.length)];
    }

    // Cold streak recovery messages (3+ losses)
    if (currentStreak <= -3) {
      const recoveryGreetings = [
        { emoji: "💪", message: "COMEBACK TIME", color: "text-orange-600" },
        { emoji: "🥊", message: "FIGHTING BACK", color: "text-red-600" },
        { emoji: "🎯", message: "REFOCUSING", color: "text-purple-600" },
      ];
      return recoveryGreetings[Math.floor(Math.random() * recoveryGreetings.length)];
    }

    // Recent loss but not a streak
    if (currentStreak <= -1) {
      const motivationGreetings = [
        { emoji: "💭", message: "STRATEGIZING", color: "text-primary" },
        { emoji: "🔄", message: "BOUNCING BACK", color: "text-green-600" },
        { emoji: "🎲", message: "NEXT LEVEL", color: "text-indigo-600" },
      ];
      return motivationGreetings[Math.floor(Math.random() * motivationGreetings.length)];
    }

    // Performance-based greetings for neutral streaks
    if (recentPerformance === "improving" && totalMatches >= 3) {
      const improvingGreetings = [
        { emoji: "📈", message: "IMPROVING", color: "text-green-500" },
        { emoji: "🚀", message: "ASCENDING", color: "text-blue-500" },
        { emoji: "⬆️", message: "RISING", color: "text-purple-500" },
      ];
      return improvingGreetings[Math.floor(Math.random() * improvingGreetings.length)];
    }

    if (recentPerformance === "declining" && totalMatches >= 3) {
      const declineGreetings = [
        { emoji: "🔧", message: "TUNING UP", color: "text-yellow-600" },
        { emoji: "🎯", message: "RECALIBRATING", color: "text-orange-600" },
        { emoji: "💡", message: "LEARNING", color: "text-primary" },
      ];
      return declineGreetings[Math.floor(Math.random() * declineGreetings.length)];
    }

    // Win rate based greetings for players with enough matches
    if (totalMatches >= 5) {
      if (winRate >= 80) {
        const eliteGreetings = [
          { emoji: "👑", message: "ELITE", color: "text-yellow-500" },
          { emoji: "💎", message: "DIAMOND", color: "text-blue-400" },
          { emoji: "🏅", message: "LEGEND", color: "text-orange-500" },
        ];
        return eliteGreetings[Math.floor(Math.random() * eliteGreetings.length)];
      }

      if (winRate >= 60) {
        const solidGreetings = [
          { emoji: "🎯", message: "SHARPSHOOTER", color: "text-green-600" },
          { emoji: "⚡", message: "CONSISTENT", color: "text-primary" },
          { emoji: "🔥", message: "SOLID", color: "text-purple-600" },
        ];
        return solidGreetings[Math.floor(Math.random() * solidGreetings.length)];
      }

      if (winRate >= 40) {
        const balancedGreetings = [
          { emoji: "⚖️", message: "BALANCED", color: "text-gray-600" },
          { emoji: "🎲", message: "COMPETITIVE", color: "text-indigo-600" },
          { emoji: "🎭", message: "UNPREDICTABLE", color: "text-purple-600" },
        ];
        return balancedGreetings[Math.floor(Math.random() * balancedGreetings.length)];
      }

      // Below 40% win rate
      const growthGreetings = [
        { emoji: "🌱", message: "GROWING", color: "text-green-500" },
        { emoji: "📚", message: "LEARNING", color: "text-blue-500" },
        { emoji: "💪", message: "GRINDING", color: "text-orange-500" },
      ];
      return growthGreetings[Math.floor(Math.random() * growthGreetings.length)];
    }

    // New player greetings (fewer than 5 matches)
    if (totalMatches === 0) {
      return { emoji: "🎾", message: "READY TO START", color: "text-primary" };
    }

    const newPlayerGreetings = [
      { emoji: "🚀", message: "GETTING STARTED", color: "text-blue-500" },
      { emoji: "🎯", message: "FINDING RHYTHM", color: "text-green-500" },
      { emoji: "⭐", message: "RISING STAR", color: "text-yellow-500" },
    ];
    return newPlayerGreetings[Math.floor(Math.random() * newPlayerGreetings.length)];
  };

  // Component: Enhanced User Header with Dynamic Performance-Based Greeting
  const renderUserHeader = () => {
    const greeting = generateDynamicGreeting();
    
    return (
      <View className="mb-6 p-4 pt-0 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl">
        <View className="flex-row items-center mb-4">
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="text-4xl mr-2">{greeting.emoji}</Text>
              <View>
                <Text className="text-2xl font-bold">
                  {profile?.full_name?.split(" ")[0] || "Player"}
                </Text>
                <Text className={`text-sm font-semibold ${greeting.color} opacity-90`}>
                  {greeting.message}
                </Text>
              </View>
            </View>
          </View>
        </View>
        }