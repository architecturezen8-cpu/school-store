"""Turn `agent-browser a11y --json` output into a short readable report."""
import json
import sys

d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/qa-a11y.json"))["data"]
violations = d["violations"]
if not violations:
    print("clean — no axe violations")
for item in violations:
    print("%s (%s) x%s" % (item["id"], item["impact"], item["nodeCount"]))
    for node in item["nodes"][:3]:
        print("   ", node["html"][:110].replace("\n", " "))
