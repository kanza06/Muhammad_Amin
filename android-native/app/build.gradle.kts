plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.kahfi.photobooth"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.kahfi.photobooth"
        minSdk = 26
        targetSdk = 28
        versionCode = 1
        versionName = "1.0.0"
    }
}
