# { "Depends": "py-genlayer:test" }

from genlayer import *
import json


class Oracle(gl.Contract):
    market_count: int
    markets_json: str

    def __init__(self):
        self.market_count = 0
        self.markets_json = "[]"

    def _load_markets(self):
        return json.loads(self.markets_json)

    def _save_markets(self, markets):
        self.markets_json = json.dumps(markets)

    def _get_market(self, market_id: int):
        markets = self._load_markets()
        for m in markets:
            if m["id"] == market_id:
                return m
        return None

    @gl.public.view
    def get_market_count(self) -> int:
        return self.market_count

    @gl.public.view
    def get_all_markets(self) -> str:
        return self.markets_json

    @gl.public.view
    def get_market(self, market_id: int) -> str:
        m = self._get_market(market_id)
        if m is None:
            return json.dumps({"error": "Market not found"})
        return json.dumps(m)

    @gl.public.view
    def get_market_odds(self, market_id: int) -> str:
        m = self._get_market(market_id)
        if m is None:
            return json.dumps({"yes": 50, "no": 50})
        total_yes = m.get("total_yes", 0)
        total_no = m.get("total_no", 0)
        total = total_yes + total_no
        if total == 0:
            return json.dumps({"yes": 50, "no": 50})
        yes_pct = round((total_yes / total) * 100)
        no_pct = 100 - yes_pct
        return json.dumps({"yes": yes_pct, "no": no_pct})

    @gl.public.write
    def create_market(
        self,
        question: str,
        category: str,
        resolution_url: str,
        resolution_date: str,
        creator: str,
    ) -> None:
        markets = self._load_markets()
        new_market = {
            "id": self.market_count,
            "question": question,
            "category": category,
            "resolution_url": resolution_url,
            "resolution_date": resolution_date,
            "creator": creator,
            "status": "open",
            "outcome": None,
            "resolution_reason": "",
            "total_yes": 0,
            "total_no": 0,
            "bets": [],
            "created_at": resolution_date,
        }
        markets.append(new_market)
        self._save_markets(markets)
        self.market_count += 1

    @gl.public.write
    def place_bet(
        self,
        market_id: int,
        bettor: str,
        side: str,
        amount: int,
    ) -> None:
        markets = self._load_markets()
        for i, m in enumerate(markets):
            if m["id"] == market_id:
                if m["status"] != "open":
                    return
                side_lower = side.lower()
                if side_lower not in ["yes", "no"]:
                    return
                markets[i]["bets"].append({
                    "bettor": bettor,
                    "side": side_lower,
                    "amount": amount,
                })
                if side_lower == "yes":
                    markets[i]["total_yes"] += amount
                else:
                    markets[i]["total_no"] += amount
                self._save_markets(markets)
                return

    @gl.public.write
    def resolve_market(self, market_id: int) -> None:
        markets = self._load_markets()
        market = None
        market_idx = -1
        for i, m in enumerate(markets):
            if m["id"] == market_id:
                market = m
                market_idx = i
                break
        if market is None or market["status"] != "open":
            return

        question = market["question"]
        category = market["category"]
        resolution_url = market["resolution_url"]

        def fetch_and_resolve() -> str:
            try:
                primary_data = gl.get_webpage(resolution_url, mode="text")
                primary_excerpt = primary_data[:2000]
            except Exception:
                primary_excerpt = "Could not fetch primary source."

            secondary_excerpt = ""
            tertiary_excerpt = ""

            try:
                if category == "crypto":
                    sec = gl.get_webpage(
                        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,cardano&vs_currencies=usd&include_24hr_change=true",
                        mode="text",
                    )
                    secondary_excerpt = sec[:2000]
                    ter = gl.get_webpage(
                        "https://api.coindesk.com/v1/bpi/currentprice.json",
                        mode="text",
                    )
                    tertiary_excerpt = ter[:1000]
                elif category == "sports":
                    sec = gl.get_webpage(
                        "https://openfootball.github.io/england/2025-26/1-premierleague.json",
                        mode="text",
                    )
                    secondary_excerpt = sec[:3000]
                    ter = gl.get_webpage(
                        "https://openfootball.github.io/champions-league/2024-25/cl.json",
                        mode="text",
                    )
                    tertiary_excerpt = ter[:2000]
                elif category == "politics":
                    sec = gl.get_webpage(
                        "https://www.reuters.com/world/",
                        mode="text",
                    )
                    secondary_excerpt = sec[:2000]
                    ter = gl.get_webpage(
                        "https://apnews.com/",
                        mode="text",
                    )
                    tertiary_excerpt = ter[:1500]
                elif category == "weather":
                    sec = gl.get_webpage(
                        "https://wttr.in/?format=j1",
                        mode="text",
                    )
                    secondary_excerpt = sec[:2000]
                elif category == "entertainment":
                    sec = gl.get_webpage(
                        "https://www.bbc.com/news/entertainment-arts",
                        mode="text",
                    )
                    secondary_excerpt = sec[:2000]
                    ter = gl.get_webpage(
                        "https://variety.com/",
                        mode="text",
                    )
                    tertiary_excerpt = ter[:1500]
            except Exception:
                secondary_excerpt = "Secondary source unavailable."

            prompt = (
                "You are an impartial AI judge resolving a prediction market.\n"
                "Determine if the market question resolves YES or NO "
                "based solely on the live data fetched below.\n\n"
                "MARKET QUESTION: " + question + "\n"
                "CATEGORY: " + category + "\n\n"
                "LIVE DATA FETCHED RIGHT NOW:\n\n"
                "SOURCE 1 - Primary URL (" + resolution_url + "):\n"
                + primary_excerpt + "\n\n"
                "SOURCE 2 - Secondary:\n"
                + secondary_excerpt + "\n\n"
                + ("SOURCE 3 - Tertiary:\n" + tertiary_excerpt + "\n\n" if tertiary_excerpt else "")
                + "RULES:\n"
                "1. If evidence clearly supports YES - return outcome: true\n"
                "2. If evidence clearly supports NO - return outcome: false\n"
                "3. If event has not happened yet - return outcome: false with LOW confidence\n"
                "4. Cite the specific data point that drove your decision.\n"
                "5. Only use the fetched data above, no prior knowledge.\n\n"
                "Respond ONLY with this exact JSON, nothing else:\n"
                "{\"outcome\": true/false, \"confidence\": \"HIGH/MEDIUM/LOW\", \"reasoning\": \"evidence cited\"}\n\n"
                "It is mandatory that you respond only using the JSON format above, nothing else.\n"
                "Don't include any other words or characters, your output must be only JSON without any formatting prefix or suffix.\n"
                "This result should be perfectly parseable by a JSON parser without errors."
            )

            res = gl.exec_prompt(prompt)
            res = res.replace("```json", "").replace("```", "").strip()
            dat = json.loads(res)
            return json.dumps({
                "outcome": dat["outcome"],
                "confidence": dat["confidence"],
                "reasoning": dat["reasoning"],
            })

        result_str = gl.eq_principle_prompt_non_comparative(
            fetch_and_resolve,
            task="Resolve a prediction market question using live web data.",
            criteria=(
                "The outcome must be supported by fetched web evidence. "
                "Reasoning must cite specific evidence. "
                "Confidence must reflect how clear the evidence is."
            ),
        )

        result = json.loads(result_str)
        outcome = result["outcome"]
        reasoning = result["reasoning"]
        confidence = result.get("confidence", "MEDIUM")

        markets[market_idx]["status"] = "resolved"
        markets[market_idx]["outcome"] = outcome
        markets[market_idx]["resolution_reason"] = (
            "[" + confidence + " confidence] " + reasoning
        )
        self._save_markets(markets)

    @gl.public.write
    def cancel_market(self, market_id: int, reason: str) -> None:
        markets = self._load_markets()
        for i, m in enumerate(markets):
            if m["id"] == market_id and m["status"] == "open":
                markets[i]["status"] = "cancelled"
                markets[i]["resolution_reason"] = reason
                self._save_markets(markets)
                return
