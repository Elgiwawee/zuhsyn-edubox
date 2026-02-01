############################################
# React Native Core
############################################
-keep class com.facebook.react.** { *; }
-dontwarn com.facebook.react.**

############################################
# Hermes
############################################
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.hermes.**

############################################
# Lottie Animations
############################################
-keep class com.airbnb.lottie.** { *; }
-dontwarn com.airbnb.lottie.**

############################################
# Gesture Handler
############################################
-keep class com.swmansion.gesturehandler.** { *; }
-dontwarn com.swmansion.gesturehandler.**

############################################
# Async Storage
############################################
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keepclassmembers class com.reactnativecommunity.asyncstorage.** { *; }
-dontwarn com.reactnativecommunity.asyncstorage.**

############################################
# React Native Sound
############################################
-keep class com.zmxv.RNSoundModule.** { *; }
-dontwarn com.zmxv.RNSoundModule.**

############################################
# Prevent stripping native modules
############################################
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers class * extends com.facebook.react.bridge.NativeModule {
    public <init>(...);
}

############################################
# Keep annotations
############################################
-keepattributes *Annotation*

############################################
# Remove logs in release
############################################
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
