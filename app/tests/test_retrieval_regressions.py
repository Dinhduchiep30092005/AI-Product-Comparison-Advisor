import unittest
from unittest.mock import patch

from app.services import agent_loop, rag, rule_engine, session, slot_filling


class _FakeCollection:
    def __init__(self, result):
        self.result = result

    def query(self, **_kwargs):
        return self.result


class TurnIsolationTests(unittest.TestCase):
    def test_begin_turn_clears_only_turn_artifacts(self):
        state = {
            "slots": {"category": "Camera"},
            "last_top": [{"product_code": "p1"}],
            "recent_tool_results": [{"old": True}],
            "citations": [{"source_document": "old.md"}],
            "last_policy_chunks": [{"chunk_text": "old"}],
            "last_enriched": {"p1": {}},
        }

        session.begin_turn(state)

        self.assertEqual(state["recent_tool_results"], [])
        self.assertEqual(state["citations"], [])
        self.assertEqual(state["last_policy_chunks"], [])
        self.assertEqual(state["last_enriched"], {})
        self.assertEqual(state["slots"]["category"], "Camera")
        self.assertEqual(state["last_top"][0]["product_code"], "p1")


class CategoryTests(unittest.TestCase):
    def test_category_is_mapped_to_catalog_taxonomy_case_insensitively(self):
        self.assertEqual(slot_filling.canonical_category("camera"), "Camera")
        self.assertEqual(slot_filling.canonical_category("LAPTOP"), "Laptop")
        self.assertIsNone(slot_filling.canonical_category("danh mục tự do không tồn tại"))


class RelevanceTests(unittest.TestCase):
    @patch("app.services.rag.embeddings.embed", return_value=[[0.1, 0.2]])
    def test_policy_drops_results_below_similarity_threshold(self, _embed):
        result = {
            "documents": [["relevant", "unrelated"]],
            "metadatas": [[
                {"policy_type": "khác", "source_document": "a.md", "section_title": "A"},
                {"policy_type": "khác", "source_document": "b.md", "section_title": "B"},
            ]],
            "distances": [[0.10, 0.40]],
        }
        with patch("app.services.rag.policy_collection", return_value=_FakeCollection(result)):
            rows = rag.search_policy_chunks("query", min_similarity=0.75)

        self.assertEqual([r["source_document"] for r in rows], ["a.md"])
        self.assertAlmostEqual(rows[0]["similarity"], 0.9)

    @patch("app.services.rag.embeddings.embed", return_value=[[0.1, 0.2]])
    def test_catalog_drops_results_below_similarity_threshold(self, _embed):
        result = {
            "documents": [["relevant", "unrelated"]],
            "metadatas": [[
                {"product_code": "p1", "category": "camera"},
                {"product_code": "p2", "category": "camera"},
            ]],
            "distances": [[0.20, 0.50]],
        }
        with patch("app.services.rag.catalog_collection", return_value=_FakeCollection(result)):
            rows = rag.search_catalog("query", "camera", min_similarity=0.75)

        self.assertEqual([r["product_code"] for r in rows], ["p1"])
        self.assertAlmostEqual(rows[0]["similarity"], 0.8)


class FreeQuestionTests(unittest.TestCase):
    def test_vague_question_does_not_search_policy(self):
        state = {"recent_tool_results": [], "citations": []}
        with patch("app.services.agent_loop.registry.call_tool") as call_tool:
            result = agent_loop._keyword_fallback("bạn đang chưa hiểu về gì?", state)

        call_tool.assert_not_called()
        self.assertEqual(result["sources"], [])
        self.assertIn("cụ thể", result["message"])

    def test_policy_sources_are_deduplicated_by_document(self):
        state = {"recent_tool_results": [], "citations": []}
        tool_result = {"results": [
            {"chunk_text": "đoạn 1", "source_document": "policy.md"},
            {"chunk_text": "đoạn 2", "source_document": "policy.md"},
        ]}
        with patch("app.services.agent_loop.registry.call_tool", return_value=tool_result):
            result = agent_loop._keyword_fallback("chính sách bảo hành", state)

        self.assertEqual(len(result["sources"]), 1)
        self.assertEqual(result["sources"][0]["source_document"], "policy.md")


class BudgetTests(unittest.TestCase):
    def test_products_above_budget_are_removed_not_products_below_budget(self):
        products = []
        for code, price in (("p1", 9_000_000), ("p2", 10_000_000), ("p3", 11_000_000)):
            products.append({
                "product_code": code,
                "product_name": code,
                "sale_price": price,
                "original_price": price,
                "specs": {},
                "rating": 0,
                "quantity_sold": 0,
                "rerank_score": 0,
            })

        top, _excluded = rule_engine.rank(products, {"budget": 10_000_000}, "Camera")

        self.assertEqual({p["product_code"] for p in top}, {"p1", "p2"})
        self.assertTrue(all(p["sale_price"] <= 10_000_000 for p in top))


class ScoresTests(unittest.TestCase):
    def test_criteria_omitted_when_spec_missing_not_faked(self):
        products = [
            {"product_code": "p1", "product_name": "Laptop A", "sale_price": 18_500_000,
             "original_price": 18_500_000, "rating": 4.5, "quantity_sold": 100,
             "rerank_score": 0.9, "specs": {"toc_do_cpu": "3.5 GHz", "ram": "8GB"}},
            {"product_code": "p2", "product_name": "Laptop B", "sale_price": 19_900_000,
             "original_price": 19_900_000, "rating": 4.2, "quantity_sold": 80,
             "rerank_score": 0.8, "specs": {"toc_do_cpu": "2.8 GHz", "ram": None}},
        ]
        slots = {"usage_purpose": "lập trình"}

        top, _excluded = rule_engine.rank(products, slots, "laptop")

        by_code = {p["product_code"]: p for p in top}
        labels_p1 = {c["label"] for c in by_code["p1"]["scores"]["criteria"]}
        labels_p2 = {c["label"] for c in by_code["p2"]["scores"]["criteria"]}
        self.assertIn("RAM cao", labels_p1)
        self.assertNotIn("RAM cao", labels_p2)  # p2 thiếu spec ram -> không bịa rating
        for p in top:
            for c in p["scores"]["criteria"]:
                self.assertTrue(1 <= c["rating"] <= 5)
                self.assertIsNotNone(c["value_display"])

    def test_overall_rank_matches_display_order(self):
        products = []
        for code, rerank in (("p1", 0.9), ("p2", 0.7), ("p3", 0.5)):
            products.append({"product_code": code, "product_name": code,
                             "sale_price": 1_000_000, "original_price": 1_000_000,
                             "rating": 0, "quantity_sold": 0, "rerank_score": rerank,
                             "specs": {}})

        top, _excluded = rule_engine.rank(products, {}, "Camera")

        self.assertEqual([p["scores"]["overall_rank"] for p in top], [1, 2, 3])
        self.assertEqual([p["product_code"] for p in top], ["p1", "p2", "p3"])
        self.assertTrue(all(p["scores"]["hard_filter_passed"] for p in top))


if __name__ == "__main__":
    unittest.main()
