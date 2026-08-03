# eval_tools.py
# Two real eval tools for Prompt2Resume, plugged into the registry you built.
#
#   query_system  -> the ADAPTER: sends an input to your live app, gets a resume back
#   grade_answer  -> the JUDGE:  checks the resume invented no facts absent from input
#
# Run this file directly to see grade_answer work on a fake example (no server needed).

import re
import json
from registry import register_tool, execute_tool, get_tool_schema


# ---------------------------------------------------------------------------
# TOOL 1 — query_system  (the adapter to your running Prompt2Resume)
# ---------------------------------------------------------------------------
# It does NOT read your code. It talks to the RUNNING app over HTTP.
# Point BASE_URL at a STAGING copy — never production (real cost, real data).
BASE_URL = "http://localhost:4000"      # or your staging URL, e.g. https://staging-...onrender.com
AUTH_TOKEN = ""                          # a JWT for a throwaway staging user

def query_system(source_material, job_description=""):
    import requests   # imported here so the file still runs if requests isn't installed
    resp = requests.post(
        f"{BASE_URL}/api/ai/generate",
        json={"sourceMaterial": source_material, "jobDescription": job_description},
        headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["content"]        # the resume JSON your app returns


# ---------------------------------------------------------------------------
# TOOL 2 — grade_answer  (the judge — first-pass groundedness check)
# ---------------------------------------------------------------------------
# Prompt2Resume's #1 promise (from your recruiter.js): "never invent employers,
# titles, dates, degrees or metrics." This checks that promise.
#
# First version = a simple heuristic, no LLM: pull the "hard facts" out of the
# resume (years and numbers) and verify each one also appears in the source input.
# A fact in the OUTPUT that is NOT in the INPUT = a suspected hallucination.
# (The production version swaps this heuristic for an LLM judge — same interface.)

def _resume_to_text(resume):
    """Flatten the resume JSON into one big searchable string."""
    return json.dumps(resume).lower()

def grade_answer(input, output):
    src = input.lower()
    out_text = _resume_to_text(output)

    # "hard facts" the model must not invent: 4-digit years and standalone numbers/percentages
    out_facts = set(re.findall(r"\b\d{4}\b", out_text))                 # years
    out_facts |= set(re.findall(r"\b\d+%\b", out_text))                 # percentages

    suspects = [f for f in out_facts if f not in src]                   # in output, not in input
    hallucinated = len(suspects) > 0
    score = 1.0 if not hallucinated else round(1 - len(suspects) / max(len(out_facts), 1), 2)

    return {
        "hallucinated": hallucinated,
        "suspects": suspects,           # facts that appear invented
        "score": score,                 # 1.0 = fully grounded
        "reasons": [f"'{s}' appears in the resume but not in the source material" for s in suspects],
    }


# ---------------------------------------------------------------------------
# Register both tools into the shelf
# ---------------------------------------------------------------------------
register_tool("query_system", "Send source material to Prompt2Resume, return its resume",
              {"source_material": str}, query_system)

register_tool("grade_answer", "Check the resume invented no facts absent from the input",
              {"input": str, "output": dict}, grade_answer)


# ---------------------------------------------------------------------------
# Demo — runs without your server. Uses a fake resume so you can see grading now.
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("menu:", get_tool_schema("grade_answer"), "\n")

    source = "Worked at Infosys from 2021 to 2023 as a software engineer on payment systems."

    # A GOOD resume: only facts from the source.
    good = {"experience": [{"company": "Infosys", "start": "2021", "end": "2023"}]}
    print("GOOD ->", execute_tool("grade_answer", {"input": source, "output": good}))

    # A BAD resume: invents a 2019 job and a 40% metric that were never in the source.
    bad = {"experience": [{"company": "Google", "start": "2019", "end": "2023",
                           "bullets": ["Boosted revenue 40%"]}]}
    print("BAD  ->", execute_tool("grade_answer", {"input": source, "output": bad}))
