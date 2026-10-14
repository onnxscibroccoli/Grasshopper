package com.omnikali.controller

enum class BootstrapState {
    SHIZUKU_UNAVAILABLE,
    SHIZUKU_PERMISSION_REQUIRED,
    SHIZUKU_READY,
    RISH_INITIALIZATION_REQUIRED,
    CONNECTING,
    CONNECTED,
    DISCONNECTED,
    REQUIRES_OPERATOR_ACTION
}

enum class JobDispatchState {
    RECEIVED,
    REJECTED,
    DISPATCHED_AWAITING_PROOF,
    FAILED
}

data class BootstrapSnapshot(
    val state: BootstrapState,
    val detail: String,
    val observedAtMs: Long = System.currentTimeMillis()
)
