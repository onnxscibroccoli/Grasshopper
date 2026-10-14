package com.omnikali.controller

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class JobLedger(context: Context) : SQLiteOpenHelper(context, "omnikali-controller.db", null, 1) {
    data class ExistingJob(val jobId: String, val idempotencyKey: String, val state: String)

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE jobs (
              job_id TEXT PRIMARY KEY NOT NULL,
              idempotency_key TEXT NOT NULL UNIQUE,
              operation TEXT NOT NULL,
              state TEXT NOT NULL CHECK(state IN
                ('RECEIVED','REJECTED','DISPATCHED_AWAITING_PROOF','FAILED')),
              detail TEXT NOT NULL,
              created_at_ms INTEGER NOT NULL,
              updated_at_ms INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX jobs_updated_at ON jobs(updated_at_ms)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        throw IllegalStateException("Unsupported controller database migration $oldVersion -> $newVersion")
    }

    @Synchronized
    fun receive(jobId: String, idempotencyKey: String, operation: String, now: Long = System.currentTimeMillis()): Boolean {
        validateIdentifier(jobId, "job id")
        validateIdentifier(idempotencyKey, "idempotency key")
        require(operation.length in 1..128) { "Invalid operation name" }
        val values = ContentValues().apply {
            put("job_id", jobId)
            put("idempotency_key", idempotencyKey)
            put("operation", operation)
            put("state", "RECEIVED")
            put("detail", "Validated message received; no side effect has been run yet")
            put("created_at_ms", now)
            put("updated_at_ms", now)
        }
        return writableDatabase.insertWithOnConflict("jobs", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1L
    }

    @Synchronized
    fun transition(jobId: String, expected: String, next: String, detail: String, now: Long = System.currentTimeMillis()): Boolean {
        val allowed = mapOf(
            "RECEIVED" to setOf("REJECTED", "DISPATCHED_AWAITING_PROOF", "FAILED")
        )
        require(allowed[expected]?.contains(next) == true) { "Illegal job state transition $expected -> $next" }
        require(detail.length <= 2000) { "Job detail exceeds limit" }
        val values = ContentValues().apply {
            put("state", next)
            put("detail", detail)
            put("updated_at_ms", now)
        }
        return writableDatabase.update(
            "jobs",
            values,
            "job_id = ? AND state = ?",
            arrayOf(jobId, expected)
        ) == 1
    }

    @Synchronized
    fun findByJobId(jobId: String): ExistingJob? = find("job_id = ?", arrayOf(jobId))

    @Synchronized
    fun findByIdempotencyKey(key: String): ExistingJob? = find("idempotency_key = ?", arrayOf(key))

    private fun find(selection: String, args: Array<String>): ExistingJob? {
        readableDatabase.query(
            "jobs",
            arrayOf("job_id", "idempotency_key", "state"),
            selection,
            args,
            null,
            null,
            null,
            "1"
        ).use { cursor ->
            if (!cursor.moveToFirst()) return null
            return ExistingJob(cursor.getString(0), cursor.getString(1), cursor.getString(2))
        }
    }

    private fun validateIdentifier(value: String, name: String) {
        require(value.matches(Regex("[A-Za-z0-9._:-]{1,128}"))) { "Invalid $name" }
    }
}
