#!/usr/bin/env python3
"""R281: preberi GitHub issue-je (avtentikacija prek vgrajenega tokena v remote URL).
Brez izpisa tokena — samo API odgovori."""
import json
import re
import subprocess
import sys
import urllib.request

url = subprocess.run(
    ["git", "-C", "/home/z/my-project", "remote", "get-url", "origin"],
    capture_output=True, text=True, check=True,
).stdout.strip()
m = re.search(r"https://([^@]+)@github\.com/", url)
if not m:
    print("NI tokena v remote URL")
    sys.exit(1)
token = m.group(1)

API = "https://api.github.com/repos/markec12345678/Roksal-Railing-Manager"


def api(path):
    req = urllib.request.Request(API + path, headers={
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "roksal-r281",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


mode = sys.argv[1] if len(sys.argv) > 1 else "list"
if mode == "list":
    for it in api("/issues?state=all&per_page=40"):
        if "pull_request" in it:
            continue
        print(f"#{it['number']} [{it['state']}] {it['title']}  (updated {it['updated_at']})")
elif mode == "view":
    n = sys.argv[2]
    it = api(f"/issues/{n}")
    print(f"#{it['number']} [{it['state']}] {it['title']}")
    print(f"labels: {[l['name'] for l in it['labels']]}")
    print(f"created {it['created_at']}  updated {it['updated_at']}")
    print("=" * 60)
    print(it["body"] or "(prazno)")
    print("=" * 60)
    comments = api(f"/issues/{n}/comments?per_page=50")
    for c in comments:
        print(f"--- comment by {c['user']['login']} at {c['created_at']} ---")
        print(c["body"])
        print()
