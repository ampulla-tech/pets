import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, PanResponder, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";

import { sheetCloses, sheetOffset } from "@pets/core/domain";
import { strings } from "@pets/core/strings";

/** Until the sheet has measured itself, it starts this far below its place. */
const OFFSCREEN = 1000;

/**
 * A sheet from the bottom of the screen, over a dimmed backdrop that closes it.
 * It slides up when it opens and down when it closes; dragging the handle moves
 * it with the finger, and letting go far enough down (or with a flick) closes
 * it, otherwise it springs back.
 */
export function Sheet({
  visible,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  // Stays mounted after `visible` turns false, until the sheet has slid away.
  const [mounted, setMounted] = useState(visible);
  const height = useRef(0);
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  function slideIn() {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }

  function slideOut(then?: () => void) {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height.current || OFFSCREEN,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => then?.());
  }

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (height.current) slideIn();
    } else if (mounted) {
      slideOut(() => setMounted(false));
    }
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => translateY.stopAnimation(),
      onPanResponderMove: (_, g) => translateY.setValue(sheetOffset(g.dy)),
      onPanResponderRelease: (_, g) => {
        if (sheetCloses(g.dy, g.vy, height.current)) {
          // The parent turns `visible` off, and that slides it the rest of the way.
          onCloseRef.current();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Animated.View className="absolute inset-0" style={{ opacity: backdrop }}>
          <Pressable
            role="button"
            accessibilityLabel={strings.app.close}
            onPress={onClose}
            className="flex-1 bg-black/40"
          />
        </Animated.View>
        <Animated.View
          testID={testID}
          onLayout={(event) => {
            const first = !height.current;
            height.current = event.nativeEvent.layout.height;
            if (first && visible) {
              translateY.setValue(height.current);
              slideIn();
            }
          }}
          className="gap-3 rounded-t-2xl bg-background px-5"
          style={{ paddingBottom: insets.bottom + 20, transform: [{ translateY }] }}
        >
          {/* The handle's hit area is the whole strip above the content. */}
          <View
            testID="sheet-handle"
            {...pan.panHandlers}
            className="-mx-5 -mb-3 h-[30px] items-center justify-center"
          >
            <View className="h-1.5 w-10 rounded-full bg-border" />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** One action in a sheet used as a menu. */
export function MenuItem({
  label,
  icon,
  onPress,
  testID,
  destructive,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  testID: string;
  destructive?: boolean;
}) {
  return (
    <Pressable
      role="menuitem"
      testID={testID}
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-3 rounded-lg px-1 active:bg-muted"
    >
      {icon}
      <Text className={destructive ? "text-late" : undefined}>{label}</Text>
    </Pressable>
  );
}
