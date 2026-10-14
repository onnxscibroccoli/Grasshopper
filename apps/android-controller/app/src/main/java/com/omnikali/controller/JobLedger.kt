package com.omnikali.controller

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class JobLedger(context: Context) : SQLiteOpenHelper(context, "omnikali-controller.db", null, 2) {
    data class ExistingJob(val jobId: String, val idempotencyKey: String, val state: String)
    data class PendingResult(
        val jobId: String,
        val state: String,
        val payload: String,
        val sha256: String,
        val detail: String
    )

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE jobs (
              job_id TEXT PRIMARY KEY NOT NULL,
              idempotency_key TEXT NOT NULL UNIQUE,
              operation TEXT NOT NULL,
              state TEXT NOT NULL CHECK(state IN
                ('RECEIVED','REJECTED','DISPATCHED_AWAITING_PROOF','PROOF_VERIFIED','FAILED')),
              detail TEXT NOT NULL,
              result_state TEXT,
              result_payload TEXT,
              result_sha256 TEXT,
              result_acknowledged_at_ms INTEGER,
              created_at_ms INTEGER NOT NULL,
              updated_at_ms INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX jobs_updated_at ON jobs(updated_at_ms)")
        db.execSQL("CREATE INDEX jobs_result_outbox ON jobs(result_acknowledged_at_ms, state)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("DROP INDEX IF EXISTS jobs_updated_at")
            db.execSQL("DROP INDEX IF EXISTS jobs_result_outbox")
            db.execSQL("ALTER TABLE jobs RENAME TO jobs_v1")
            onCreate(db)
            db.execSQL(
                """
                INSERT INTO jobs (
                  job_id, idempotency_key, operation, state, detail, created_at_ms, updated_at_ms
                )
                SELECT job_id, idempotency_key, operation, state, detail, created_at_ms, updated_at_ms
                FROM jobs_v1
                """.trimIndent()
            )
            db.execSQL("DROP TABLE jobs_v1")
        }
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
            "RECEIVED" to setOf("REJECTED", "DISPATCHED_AWAITING_PROOF", "FAILED"),
            "DISPATCHED_AWAITING_PROOF" to setOf("PROOF_VERIFIED", "FAILED")
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
    fun completeWithProof(
        jobId: String,
        outcomeState: String,
        reportedState: String,
        detail: String,
        payload: String,
        sha256: String,
        now: Long = System.currentTimeMillis()
    ): Boolean {
        require(outcomeState == "PROOF_VERIFIED" || outcomeState == "FAILED") { "Invalid stored proof outcome" }
        require(reportedState == "PROOF_VERIFIED" || reportedState == "NOT_PROVEN") { "Invalid reported proof state" }
        require(detail.length <= 2000 && payload.length <= 4096) { "Proof result exceeds its size limit" }
        require(sha256.matches(Regex("[a-f0-9]{64}"))) { "Invalid result SHA-256" }
        val values = ContentValues().apply {
            put("state", outcomeState)
            put("detail", detail)
            put("result_state", reportedState)
            put("result_payload", payload)
            put("result_sha256", sha256)
            putNull("result_acknowledged_at_ms")
            put("updated_at_ms", now)
        }
        return writableDatabase.update(
            "jobs",
            values,
            "job_id = ? AND state = ? AND result_payload IS NULL",
            arrayOf(jobId, "DISPATCHED_AWAITING_PROOF")
        ) == 1
    }

    @Synchronized
    fun pendingResults(limit: Int = 50): List<PendingResult> {
        require(limit in 1..500) { "Invalid outbox page size" }
        val rows = ArrayList<PendingResult>()
        readableDatabase.query(
            "jobs",
            arrayOf("job_id", "result_state", "result_payload", "result_sha256", "detail"),
            "result_payload IS NOT NULL AND result_sha256 IS NOT NULL AND result_acknowledged_at_ms IS NULL",
            null,
            null,
            null,
            "updated_at_ms ASC",
            limit.toString()
        ).use { cursor ->
            while (cursor.moveToNext()) {
                rows += PendingResult(
                    cursor.getString(0),
                    cursor.getString(1) ?: "NOT_PROVEN",
                    cursor.getString(2),
                    cursor.getString(3),
                    cursor.getString(4)
                )
            }
        }
        return rows
    }

    @Synchronized
    fun markResultAcknowledged(jobId: String, now: Long = System.currentTimeMillis()): Boolean {
        val values = ContentValues().apply {
            put("result_acknowledged_at_ms", now)
            put("updated_at_ms", now)
        }
        return writableDatabase.update(
            "jobs",
            values,
            "job_id = ? AND result_payload IS NOT NULL AND result_acknowledged_at_ms IS NULL",
            arrayOf(jobId)
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
