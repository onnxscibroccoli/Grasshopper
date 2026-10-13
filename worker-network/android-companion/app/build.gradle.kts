plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "org.broccoli.companion"
    compileSdk = 35
    defaultConfig {
        applicationId = "org.broccoli.companion.gateway"
        minSdk = 30
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0-bootstrap"
    }
    buildTypes {
        getByName("debug") {
            applicationIdSuffix = ".bootstrap"
            versionNameSuffix = "-debug"
            isDebuggable = true
        }
        getByName("release") {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.fragment:fragment-ktx:1.8.5")
    implementation("androidx.biometric:biometric:1.1.0")
}
