#!/usr/bin/env python3
"""Read-only zero-billable policy preflight for Grasshopper / Antigravity.
NOT an IAM enforcement mechanism. It NEVER authorizes resource creation.
"""
import datetime, json, os, pathlib, subprocess, sys, time
import oci
T=time.monotonic()
def progress(i,msg):
 print(f'STATUS [{i:02}/07] {int(i*100/7):3}% {msg} elapsed={time.monotonic()-T:.1f}s',flush=True)
def pcall(fn,*args,**kwargs):
 return oci.pagination.list_call_get_all_results(fn,*args,**kwargs).data
print('=== GRASSHOPPER ZERO-BILLABLE PREFLIGHT / READ ONLY ===')
progress(1,'Load existing OCI authentication without displaying secrets')
try:
 conf=oci.config.from_file(profile_name='OMNIKALI')
 signer=oci.auth.signers.SecurityTokenSigner(
  pathlib.Path(os.path.expanduser(conf['security_token_file'])).read_text().strip(),
  oci.signer.load_private_key_from_file(os.path.expanduser(conf['key_file']))
 )
 setting={'region':'us-ashburn-1'}
 args={'signer':signer,'timeout':(8,20),'retry_strategy':oci.retry.NoneRetryStrategy()}
 iam=oci.identity.IdentityClient(setting,**args)
 comp=oci.core.ComputeClient(setting,**args)
 blk=oci.core.BlockstorageClient(setting,**args)
 root=conf['tenancy']
 comps=pcall(iam.list_compartments,root,compartment_id_in_subtree=True,access_level='ACCESSIBLE')
 places=[root]+[c.id for c in comps if c.lifecycle_state!='DELETED']
 ads=pcall(iam.list_availability_domains,root)
 print('OCI_PROFILE=OMNIKALI AUTH=PASS REGIONS=us-ashburn-1 ACCESSIBLE_COMPARTMENTS',len(places))
except Exception as e:
 print('BLOCKED OCI_SIGNED_AUTH_OR_SDK',type(e).__name__,getattr(e,'status',None))
 sys.exit(2)
progress(2,'Inventory live A1 and E2.micro compute allocations')
total_ocpu=0;total_gib=0;micro=0;computes=0
try:
 for cid in places:
  for i in pcall(comp.list_instances,cid):
   if i.lifecycle_state in ('TERMINATED','TERMINATING'):continue
   computes+=1
   if i.shape=='VM.Standard.A1.Flex':
    sc=i.shape_config
    total_ocpu+=float(sc.ocpus or 0)
    total_gib+=float(sc.memory_in_gbs or 0)
   if i.shape=='VM.Standard.E2.1.Micro':micro+=1
 print('OCI_ACTIVE_INSTANCES',computes,'A1_OCPU',total_ocpu,'A1_GIB',total_gib,'E2_MICRO',micro)
except Exception as e:
 print('BLOCKED COMPUTE_INVENTORY_FAILED',type(e).__name__,getattr(e,'status',None));sys.exit(2)
progress(3,'Check allocated boot and block volume GB')
disk=0; boot_count=0;block_count=0
try:
 for cid in places:
  for ad in ads:
   for x in pcall(blk.list_boot_volumes,compartment_id=cid,availability_domain=ad.name):
    if x.lifecycle_state not in ('TERMINATED','TERMINATING'):
     disk+=int(x.size_in_gbs or 0);boot_count+=1
  for x in pcall(blk.list_volumes,compartment_id=cid):
   if x.lifecycle_state not in ('TERMINATED','TERMINATING'):
    disk+=int(x.size_in_gbs or 0);block_count+=1
 print('OCI_ALLOCATED_STORAGE_GB',disk,'ALWAYS_FREE_CAP_GB',200,'REMAINING_GB',200-disk,'BOOT_VOLUMES',boot_count,'BLOCK_VOLUMES',block_count)
except Exception as e:
 print('BLOCKED STORAGE_INVENTORY_FAILED',type(e).__name__,getattr(e,'status',None));sys.exit(2)
progress(4,'Evaluate conservative OCI Always Free thresholds')
cap_ok=(total_ocpu<=2 and total_gib<=12 and micro<=2 and disk<=200)
print('CONSERVATIVE_FREE_QUOTAS', 'WITHIN_CURRENT_CAPS' if cap_ok else 'EXCEEDED_OR_NOT_FREE')
print('NEW_OCI_COMPUTE=BLOCKED NEW_OCI_STORAGE=BLOCKED PENDING_EXPLICIT_FREE_ELIGIBILITY_APPROVAL')
progress(5,'Review Google Cloud project billing switches (read-only)')
projects=['omnikali','gen-lang-client-0063997183','gen-lang-client-0111597832','project-2ce61e7b-49cc-43d3-ab8']
billing_unknown=False; billing_enabled=[]
for pr in projects:
 try:
  p=subprocess.run(['gcloud','billing','projects','describe',pr,'--format=json','--quiet'],capture_output=True,text=True,timeout=25)
  if p.returncode: billing_unknown=True; print('GCP',pr,'BILLING_STATUS=UNKNOWN')
  else:
   j=json.loads(p.stdout);enabled=bool(j.get('billingEnabled'))
   if enabled:billing_enabled.append(pr)
   print('GCP',pr,'BILLING_ENABLED',enabled)
 except Exception as e:billing_unknown=True;print('GCP',pr,'BILLING_STATUS=UNKNOWN',type(e).__name__)
print('NEW_GOOGLE_CLOUD_RESOURCES=BLOCKED')
progress(6,'Apply zero-billable policy to agents and MCP')
print('POLICY: planning/read-only checks allowed; no deployment, billing enablement, upgrades or paid API usage')
print('WARNING: this script is an advisory gate, not service-side IAM or billing hard cap')
if billing_enabled:print('ALERT: GCP_BILLING_ENABLED_PROJECTS',len(billing_enabled))
progress(7,'Record final recommendation')
if not cap_ok or billing_unknown or billing_enabled:
 print('RESULT=BLOCKED_REVIEW_REQUIRED')
 sys.exit(2)
print('RESULT=PASS_EXISTING_RESOURCES_ONLY')
print('NEW_RESOURCES=NOT_AUTHORIZED; NO_CLOUD_RESOURCE_MODIFICATIONS')
