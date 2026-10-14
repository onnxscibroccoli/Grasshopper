import datetime as dt
import importlib.util
import pathlib
import tempfile
import unittest

HERE=pathlib.Path(__file__).resolve().parents[2]/"scripts"/"agentic-ci"
def load(name):
    spec=importlib.util.spec_from_file_location(name,HERE/(name+".py"))
    obj=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj
ledger=load("proof_ledger")
hitl=load("environment_guard")
rec=load("zero_recursion_live")

class ActivationEvidenceTests(unittest.TestCase):
    def test_sha_receipts_require_true_acceptance(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d)
            f=root/"redroid.bin";f.write_bytes(b"verified build bytes")
            manifest=root/"proof.json"
            for tests,cycle in ((False,True),(True,False)):
                with self.assertRaises(ValueError):
                    ledger.create(f,manifest,"org/project","44","refs/heads/main",tests,cycle)
            result=ledger.create(f,manifest,"org/project","44","refs/heads/main",True,True)
            self.assertEqual(len(result["sha256"]),64)
            self.assertTrue(ledger.verify(f,manifest))
            f.write_bytes(b"tampered")
            self.assertFalse(ledger.verify(f,manifest))
            with self.assertRaises(ValueError):
                ledger.create(f,manifest,"org/project","44","refs/heads/main",True,True)

    def test_environment_protection_requires_real_reviewers(self):
        self.assertFalse(hitl.has_reviewers({}))
        self.assertFalse(hitl.has_reviewers({"protection_rules":[{"type":"wait_timer"}]}))
        self.assertFalse(hitl.has_reviewers(
            {"protection_rules":[{"type":"required_reviewers","reviewers":[]}]}))
        self.assertTrue(hitl.has_reviewers(
            {"protection_rules":[{"type":"required_reviewers",
                                  "reviewers":[{"type":"User","reviewer":{"login":"owner"}}]}]}))

    def test_live_proof_requires_actual_unique_observer(self):
        now=dt.datetime.now(dt.timezone.utc)
        date=lambda x:x.strftime("%Y-%m-%dT%H:%M:%SZ")
        c={"id":50,"name":rec.CANARY,"conclusion":"failure",
           "head_branch":"main","event":"workflow_dispatch",
           "updated_at":date(now-dt.timedelta(minutes=5))}
        observer={"id":52,"name":rec.OBSERVER,
                  "event":"workflow_run","status":"completed","conclusion":"success",
                  "created_at":date(now-dt.timedelta(minutes=4))}
        result=rec.evaluate(c,[observer],now)
        self.assertTrue(result["no_recursive_children_in_window"])
        with self.assertRaises(ValueError):
            rec.evaluate(c,[observer,dict(observer,id=53)],now)
        with self.assertRaises(ValueError):
            rec.evaluate(c,[dict(observer,conclusion="skipped")],now)
        with self.assertRaises(ValueError):
            rec.evaluate(c,[observer],now-dt.timedelta(minutes=4))

if __name__=="__main__":unittest.main()
