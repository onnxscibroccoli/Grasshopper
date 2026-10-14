package com.omnikali.controller

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ControlPlaneTargetTest {
    @Test
    fun acceptsHostAndTlsPort() {
        val target = ControlPlaneTarget("control.example.net", 443)
        assertEquals("control.example.net", target.host)
        assertEquals(443, target.port)
    }

    @Test
    fun rejectsUrlInsteadOfHostname() {
        assertThrows(IllegalArgumentException::class.java) {
            ControlPlaneTarget("https://control.example.net", 443)
        }
    }

    @Test
    fun rejectsInvalidPort() {
        assertThrows(IllegalArgumentException::class.java) {
            ControlPlaneTarget("control.example.net", 0)
        }
        assertThrows(IllegalArgumentException::class.java) {
            ControlPlaneTarget("control.example.net", 65536)
        }
    }
}
