# v0.3.0 — comparative consensus on winner digit (fixes UNDETERMINED)
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json
import typing


class PredictionMarketHub(gl.Contract):
    """A single contract that hosts many prediction markets, each addressed
    by a numeric market id. Anyone can create a market, bet on either side
    (real GEN escrow), trigger AI-oracle resolution, and claim a pro-rata
    share of the pool."""

    next_id: u256

    # Per-market scalar fields (keyed by market id)
    creators: TreeMap[u256, Address]
    questions: TreeMap[u256, str]
    options1: TreeMap[u256, str]
    options2: TreeMap[u256, str]
    resolution_urls: TreeMap[u256, str]
    closes_ats: TreeMap[u256, u256]
    has_resolveds: TreeMap[u256, bool]
    winners: TreeMap[u256, u256]  # 0 unresolved, 1, 2, or 3 (refund)
    resolution_notes: TreeMap[u256, str]
    totals_option1: TreeMap[u256, u256]
    totals_option2: TreeMap[u256, u256]

    # Per-(market, user) bet ledgers, keyed by "<market_id>:<address>"
    bets_option1: TreeMap[str, u256]
    bets_option2: TreeMap[str, u256]
    claimed: TreeMap[str, bool]

    def __init__(self) -> None:
        self.next_id = u256(0)

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------

    def _key(self, market_id: u256, user: Address) -> str:
        return str(int(market_id)) + ":" + str(user)

    # ------------------------------------------------------------------
    # Market lifecycle
    # ------------------------------------------------------------------

    @gl.public.write
    def create_market(
        self,
        question: str,
        option1: str,
        option2: str,
        resolution_url: str,
        closes_at: u256,
    ) -> u256:
        mid = self.next_id
        self.creators[mid] = gl.message.sender_address
        self.questions[mid] = question
        self.options1[mid] = option1
        self.options2[mid] = option2
        self.resolution_urls[mid] = resolution_url
        self.closes_ats[mid] = closes_at
        self.has_resolveds[mid] = False
        self.winners[mid] = u256(0)
        self.resolution_notes[mid] = ""
        self.totals_option1[mid] = u256(0)
        self.totals_option2[mid] = u256(0)
        self.next_id = u256(int(mid) + 1)
        return mid

    @gl.public.write.payable
    def place_bet(self, market_id: u256, option: u256) -> None:
        if self.has_resolveds.get(market_id, False):
            raise Exception("Market already resolved")
        opt = int(option)
        if opt != 1 and opt != 2:
            raise Exception("Option must be 1 or 2")
        value = int(gl.message.value)
        if value <= 0:
            raise Exception("Bet must be > 0")
        sender = gl.message.sender_address
        key = self._key(market_id, sender)
        if opt == 1:
            current = int(self.bets_option1.get(key, u256(0)))
            self.bets_option1[key] = u256(current + value)
            self.totals_option1[market_id] = u256(
                int(self.totals_option1.get(market_id, u256(0))) + value
            )
        else:
            current = int(self.bets_option2.get(key, u256(0)))
            self.bets_option2[key] = u256(current + value)
            self.totals_option2[market_id] = u256(
                int(self.totals_option2.get(market_id, u256(0))) + value
            )

    @gl.public.write
    def resolve(self, market_id: u256) -> None:
        if self.has_resolveds.get(market_id, False):
            raise Exception("Already resolved")

        url = self.resolution_urls[market_id]
        opt1 = self.options1[market_id]
        opt2 = self.options2[market_id]
        question = self.questions[market_id]
        t1 = int(self.totals_option1.get(market_id, u256(0)))
        t2 = int(self.totals_option2.get(market_id, u256(0)))

        if t1 == 0 or t2 == 0:
            self.winners[market_id] = u256(3)
            self.resolution_notes[market_id] = "Refund: one side had no bets"
            self.has_resolveds[market_id] = True
            return

        def get_resolution() -> str:
            # Try text mode first; fall back to html mode if the page
            # is bot-protected or returns a non-text response.
            web_data = ""
            last_err = ""
            for mode in ("text", "html"):
                try:
                    web_data = gl.nondet.web.render(url, mode=mode)
                    if web_data and len(str(web_data).strip()) > 40:
                        break
                except Exception as e:
                    last_err = str(e)
                    web_data = ""
            if not web_data:
                raise Exception(
                    "Resolution page could not be loaded (likely bot-blocked). "
                    "Use a source like Wikipedia, a press release, or an official "
                    "data page that does not require JavaScript challenges. "
                    "Last error: " + last_err
                )

            task = f"""
You are resolving a prediction market.

Question: {question}
Option 1: {opt1}
Option 2: {opt2}

Web page content:
{web_data}

Based ONLY on the web page content, decide the answer.
Reply with EXACTLY ONE token, no punctuation, no explanation:
- "1" if Option 1 is correct
- "2" if Option 2 is correct
- "0" if it cannot be determined yet
"""

            result = gl.nondet.exec_prompt(task)
            # Extract first 0/1/2 digit so minor whitespace/wording differences don't matter
            for ch in str(result):
                if ch in ("0", "1", "2"):
                    return ch
            return "0"

        decision = gl.eq_principle.prompt_comparative(
            get_resolution,
            "Both outputs must be the same single digit (0, 1, or 2) representing the winning option.",
        )

        # decision is the agreed string ("0", "1", or "2")
        try:
            winner = int(str(decision).strip()[0])
        except Exception:
            winner = 0

        if winner != 1 and winner != 2:
            raise Exception(
                "Oracle could not determine a winner from the resolution page. "
                "The market may not be decidable yet, or the source page lacks a clear answer."
            )

        notes = f"Resolved by GenLayer oracle from {url}"

        self.winners[market_id] = u256(winner)
        self.resolution_notes[market_id] = notes
        self.has_resolveds[market_id] = True

    @gl.public.write
    def claim(self, market_id: u256) -> None:
        if not self.has_resolveds.get(market_id, False):
            raise Exception("Market not resolved")
        sender = gl.message.sender_address
        key = self._key(market_id, sender)
        if self.claimed.get(key, False):
            raise Exception("Already claimed")

        b1 = int(self.bets_option1.get(key, u256(0)))
        b2 = int(self.bets_option2.get(key, u256(0)))
        w = int(self.winners.get(market_id, u256(0)))
        t1 = int(self.totals_option1.get(market_id, u256(0)))
        t2 = int(self.totals_option2.get(market_id, u256(0)))
        pool = t1 + t2

        payout = 0
        if w == 3:
            payout = b1 + b2
        elif w == 1 and b1 > 0 and t1 > 0:
            payout = (b1 * pool) // t1
        elif w == 2 and b2 > 0 and t2 > 0:
            payout = (b2 * pool) // t2

        if payout <= 0:
            raise Exception("Nothing to claim")

        self.claimed[key] = True
        gl.transfer(sender, int(payout))

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------

    @gl.public.view
    def get_market_count(self) -> u256:
        return self.next_id

    @gl.public.view
    def get_market(self, market_id: u256) -> str:
        out = {
            "id": int(market_id),
            "question": self.questions.get(market_id, ""),
            "option1": self.options1.get(market_id, ""),
            "option2": self.options2.get(market_id, ""),
            "resolution_url": self.resolution_urls.get(market_id, ""),
            "has_resolved": self.has_resolveds.get(market_id, False),
            "winner": int(self.winners.get(market_id, u256(0))),
            "resolution_notes": self.resolution_notes.get(market_id, ""),
            "total_option1": str(int(self.totals_option1.get(market_id, u256(0)))),
            "total_option2": str(int(self.totals_option2.get(market_id, u256(0)))),
            "creator": str(self.creators.get(market_id, gl.message.sender_address)),
            "closes_at": int(self.closes_ats.get(market_id, u256(0))),
        }
        return json.dumps(out)

    @gl.public.view
    def get_markets(self) -> str:
        out = []
        n = int(self.next_id)
        for i in range(n):
            mid = u256(i)
            out.append({
                "id": i,
                "question": self.questions.get(mid, ""),
                "option1": self.options1.get(mid, ""),
                "option2": self.options2.get(mid, ""),
                "resolution_url": self.resolution_urls.get(mid, ""),
                "has_resolved": self.has_resolveds.get(mid, False),
                "winner": int(self.winners.get(mid, u256(0))),
                "resolution_notes": self.resolution_notes.get(mid, ""),
                "total_option1": str(int(self.totals_option1.get(mid, u256(0)))),
                "total_option2": str(int(self.totals_option2.get(mid, u256(0)))),
                "creator": str(self.creators.get(mid, gl.message.sender_address)),
                "closes_at": int(self.closes_ats.get(mid, u256(0))),
            })
        return json.dumps(out)

    @gl.public.view
    def get_user_bets(self, market_id: u256, user: str) -> str:
        addr = Address(user)
        key = self._key(market_id, addr)
        b1 = int(self.bets_option1.get(key, u256(0)))
        b2 = int(self.bets_option2.get(key, u256(0)))
        is_claimed = self.claimed.get(key, False)
        payout = 0
        if self.has_resolveds.get(market_id, False):
            w = int(self.winners.get(market_id, u256(0)))
            t1 = int(self.totals_option1.get(market_id, u256(0)))
            t2 = int(self.totals_option2.get(market_id, u256(0)))
            pool = t1 + t2
            if w == 3:
                payout = b1 + b2
            elif w == 1 and b1 > 0 and t1 > 0:
                payout = (b1 * pool) // t1
            elif w == 2 and b2 > 0 and t2 > 0:
                payout = (b2 * pool) // t2
        return json.dumps({
            "option1": str(b1),
            "option2": str(b2),
            "claimed": is_claimed,
            "payout": str(payout),
        })
