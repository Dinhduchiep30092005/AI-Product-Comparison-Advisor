"""Domain Rule Engine (Flow_RAG.md + Flow_slot_filling.md mục 2) — thuần code, không qua LLM.

- Hard filter: loại thẳng sản phẩm không đáp ứng điều kiện bắt buộc.
  Nguyên tắc: field cần cho hard filter mà sản phẩm THIẾU dữ liệu → KHÔNG loại (pass),
  tránh loại oan vì thiếu data.
- Soft scoring: công thức tường minh theo từng ngành hàng, kết hợp điểm rerank.
- Budget: loại nếu ngoài budget, trừ khi <2 sản phẩm còn lại thì nới dần (ghi rõ vượt).
"""
import math
import re


# ── Helpers đọc spec ───────────────────────────────────────────────

def spec_get(specs: dict, *substrings: str):
    """Tìm value của key spec chứa 1 trong các substring (key đã snake_case)."""
    for sub in substrings:
        for k, v in specs.items():
            if sub in k and v:
                return v
    return None


def num(value) -> float | None:
    """Trích số đầu tiên: "16 dB"->16, "3.000 mAh"->3000, "1,5 HP"->1.5."""
    if value is None:
        return None
    s = str(value)
    m = re.search(r"\d{1,3}(?:\.\d{3})+(?!\d)|\d+(?:[.,]\d+)?", s)
    if not m:
        return None
    t = m.group(0)
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+", t):
        t = t.replace(".", "")
    else:
        t = t.replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def parse_room_range(value):
    """Parse "Từ 30-40m2" / "Dưới 15m2" / "15 - 20 m²" → (min, max)."""
    if not value:
        return None
    s = str(value).lower()
    nums = [float(x.replace(",", ".")) for x in re.findall(r"\d+(?:[.,]\d+)?", s)]
    if not nums:
        return None
    if len(nums) >= 2:
        return (min(nums[0], nums[1]), max(nums[0], nums[1]))
    if "dưới" in s or "duoi" in s or "<" in s:
        return (0, nums[0])
    if "trên" in s or "tren" in s or ">" in s or "từ" in s:
        return (nums[0], nums[0] * 1.5)
    return (nums[0] * 0.8, nums[0] * 1.2)


def aircon_room_range(specs: dict):
    """Room size resolution máy lạnh: phạm vi làm lạnh (chính) → BTU/600 (fallback)."""
    rng = parse_room_range(spec_get(specs, "pham_vi_lam_lanh"))
    if rng:
        return rng
    btu_val = spec_get(specs, "cong_suat_lam_lanh")
    if btu_val and "btu" in str(btu_val).lower():
        btu = num(btu_val)
        if btu and btu > 1000:
            m2 = btu / 600.0
            return (m2 * 0.75, m2 * 1.15)
    return None  # cả 2 null → không loại


def household_floor(household: float | None, table: dict) -> float | None:
    if household is None:
        return None
    if household <= 2:
        return table["small"]
    if household <= 4:
        return table["medium"]
    return table["large"]


def _priority(slots: dict, *names: str) -> bool:
    pri = slots.get("usage_priority") or []
    purpose = (slots.get("usage_purpose") or "").lower()
    return any(n in pri for n in names) or any(n in purpose for n in names)


# ── Hard filters theo category ─────────────────────────────────────

def hard_filter_category(p: dict, slots: dict, category: str) -> str | None:
    """Trả về lý do loại (str) hoặc None nếu pass. KHÔNG xét budget ở đây."""
    specs = p.get("specs") or {}

    if category == "máy lạnh":
        room = slots.get("room_size")
        if room:
            rng = aircon_room_range(specs)
            if rng and not (rng[0] <= room <= rng[1]):
                return (f"phạm vi làm lạnh {rng[0]:.0f}-{rng[1]:.0f}m² "
                        f"không phù hợp phòng {room:g}m²")
        return None

    if category == "tủ lạnh":
        floor = household_floor(slots.get("household_size"),
                                {"small": 150, "medium": 250, "large": 350})
        if floor:
            v = num(spec_get(specs, "dung_tich_su_dung", "dung_tich"))
            if v and v < floor:
                return f"dung tích {v:.0f}L dưới ngưỡng {floor:.0f}L cho gia đình"
        return None

    if category in ("máy giặt", "máy sấy quần áo"):
        # Ưu tiên field "Số người sử dụng" nếu có, hơn suy luận từ khối lượng
        household = slots.get("household_size")
        if household:
            so_nguoi = spec_get(specs, "so_nguoi_su_dung")
            if so_nguoi:
                rng = parse_room_range(so_nguoi)
                if rng and not (rng[0] <= household <= rng[1] + 0.5):
                    return f"thiết kế cho {so_nguoi}, không khớp {household:g} người"
                return None
            floor = household_floor(household, {"small": 7, "medium": 9, "large": 10})
            key = "khoi_luong_giat" if category == "máy giặt" else "khoi_luong_say"
            v = num(spec_get(specs, key, "khoi_luong"))
            if v and floor and v < floor:
                return f"khối lượng {v:g}kg dưới ngưỡng {floor:g}kg cho {household:g} người"
        return None

    if category == "máy rửa chén":
        household = slots.get("household_size")
        if household:
            v = num(spec_get(specs, "khay_chen", "so_bo_chen", "bo_chen"))
            if v and v < math.ceil(household):
                return f"chỉ {v:.0f} bộ chén, không đủ cho {household:g} người"
        return None

    if category == "tủ đông, tủ mát":
        purpose = (slots.get("usage_purpose") or "").lower()
        v = num(spec_get(specs, "dung_tich_tong", "dung_tich"))
        if v:
            if "kinh doanh" in purpose and v < 200:
                return f"dung tích {v:.0f}L nhỏ, không hợp kinh doanh (cần >200L)"
        return None

    if category == "máy nước nóng":
        pref = (slots.get("heater_type_preference") or "").lower()
        if pref:
            loai = (spec_get(specs, "loai_may") or "").lower()
            if loai and pref not in loai:
                return f"loại máy '{loai}' không khớp yêu cầu '{pref}'"
        return None

    if category == "đồng hồ thông minh":
        if _priority(slots, "health_tracking"):
            # Field "Theo dõi sức khoẻ" riêng không tồn tại — dùng "Tiện ích khác" làm proxy
            tienich = (spec_get(specs, "tien_ich") or "").lower()
            keywords = ("sức khỏe", "suc khoe", "nhịp tim", "nhip tim", "spo2",
                        "thể thao", "the thao", "vận động", "van dong")
            if tienich and not any(kw in tienich for kw in keywords):
                return "không có tiện ích theo dõi sức khỏe/thể thao"
        return None

    if category in ("loa, tai nghe", "pc, máy in"):
        want = slots.get("device_type")
        if want and p.get("device_type") and p["device_type"] != "khac" \
                and p["device_type"] != want:
            return f"loại thiết bị '{p['device_type']}' không khớp nhu cầu '{want}'"
        return None

    if category == "nồi cơm điện":
        floor = household_floor(slots.get("household_size"),
                                {"small": 1.0, "medium": 1.5, "large": 2.0})
        if floor:
            v = num(spec_get(specs, "dung_tich"))
            if v and v < floor:
                return f"dung tích {v:g}L dưới ngưỡng {floor:g}L cho gia đình"
        return None

    return None  # Nhóm 2 + các category còn lại: chỉ lọc budget


# ── Soft scoring ───────────────────────────────────────────────────

def _signals_for(category: str, slots: dict) -> list[tuple]:
    """Danh sách (tên_tín_hiệu, spec_substrings, direction(+1/-1), weight, label)."""
    s = []
    quiet = slots.get("noise_priority") == "quiet"
    energy = _priority(slots, "energy_saving", "tiết kiệm")
    battery = slots.get("battery_priority") or _priority(slots, "battery")

    if category == "máy lạnh":
        if energy:
            s.append(("energy", ("nhan_nang_luong",), +1, 1.0, "nhãn năng lượng cao"))
        if quiet:
            s.append(("noise", ("do_on",), -1, 1.0, "độ ồn thấp, chạy êm"))
    elif category == "tủ lạnh":
        if energy:
            s.append(("power", ("cong_suat_tieu_thu",), -1, 1.0, "tiêu thụ điện thấp"))
        if _priority(slots, "capacity"):
            s.append(("cap", ("dung_tich",), +1, 0.8, "dung tích lớn"))
    elif category == "máy giặt":
        s.append(("spin", ("toc_do_quay",), +1, 0.4, "vắt khô nhanh"))
    elif category == "máy sấy quần áo":
        if energy:
            s.append(("heatpump", ("cong_nghe",), 0, 1.0, "công nghệ bơm nhiệt tiết kiệm điện"))
    elif category == "máy rửa chén":
        if quiet:
            s.append(("noise", ("do_on",), -1, 1.0, "độ ồn thấp"))
    elif category == "tủ đông, tủ mát":
        if energy:
            s.append(("power", ("dien_nang", "cong_suat"), -1, 1.0, "điện năng tiêu thụ thấp"))
    elif category == "máy nước nóng":
        hh = slots.get("household_size") or 0
        if hh >= 4:
            s.append(("heatpow", ("cong_suat",), +1, 0.7, "công suất làm nóng cao"))
            s.append(("tank", ("dung_tich",), +1, 0.7, "bình chứa lớn"))
    elif category == "micro":
        purpose = (slots.get("usage_purpose") or "").lower()
        if "karaoke" in purpose:
            s.append(("freq", ("tan_so", "bang_tan"), 0, 1.0, "có băng tần/tần số karaoke"))
        elif purpose:
            s.append(("range", ("khoang_cach",), +1, 0.8, "khoảng cách truyền xa"))
            s.append(("bat", ("thoi_luong_pin", "pin"), +1, 0.6, "pin lâu"))
    elif category == "đồng hồ thông minh":
        if battery:
            s.append(("bat", ("thoi_gian_su_dung", "pin"), +1, 1.0, "pin dùng lâu"))
    elif category == "máy tính bảng":
        if battery:
            s.append(("bat", ("dung_luong_pin",), +1, 1.0, "pin dung lượng lớn"))
        if _priority(slots, "performance", "học tập", "vẽ", "giải trí"):
            s.append(("ram", ("ram",), +1, 0.8, "RAM cao"))
    elif category == "laptop":
        purpose = (slots.get("usage_purpose") or "").lower()
        if any(k in purpose for k in ("gaming", "game", "đồ họa", "do hoa", "lập trình")):
            s.append(("cpu", ("toc_do_cpu",), +1, 0.8, "CPU nhanh"))
            s.append(("cores", ("so_nhan",), +1, 0.5, "nhiều nhân"))
            s.append(("ram", ("ram",), +1, 0.6, "RAM cao"))
        if slots.get("portability_priority"):
            s.append(("weight", ("khoi_luong", "trong_luong"), -1, 0.8, "mỏng nhẹ dễ mang"))
    elif category == "điện thoại":
        if battery:
            s.append(("bat", ("dung_luong_pin",), +1, 1.0, "pin dung lượng lớn"))
        if _priority(slots, "camera"):
            s.append(("cam", ("do_phan_giai_camera_sau", "camera_sau"), +1, 1.0, "camera sau nét"))
        if _priority(slots, "performance"):
            s.append(("cpu", ("toc_do_cpu",), +1, 1.0, "CPU nhanh"))
        if _priority(slots, "storage"):
            s.append(("sto", ("dung_luong_luu_tru",), +1, 1.0, "bộ nhớ lớn"))
        if _priority(slots, "design"):
            s.append(("weight", ("khoi_luong", "trong_luong"), -1, 0.8, "máy nhẹ"))
    elif category == "tivi":
        purpose = (slots.get("usage_purpose") or "").lower()
        if "gaming" in purpose or "game" in purpose:
            s.append(("hz", ("tan_so_quet",), +1, 1.0, "tần số quét cao, chơi game mượt"))
        s.append(("res", ("do_phan_giai",), 0, 0.4, "độ phân giải cao"))
    elif category == "loa, tai nghe":
        if battery and slots.get("device_type") == "tai_nghe":
            s.append(("bat", ("thoi_luong_pin", "pin"), +1, 1.0, "pin lâu"))
    elif category == "máy hút bụi gia đình":
        s.append(("suction", ("cong_suat_hut", "cong_suat"), +1, 0.6, "lực hút mạnh"))
        if quiet:
            s.append(("noise", ("do_on",), -1, 1.0, "độ ồn thấp"))
        if (slots.get("household_size") or 0) >= 4:
            s.append(("cap", ("dung_tich",), +1, 0.5, "hộp chứa lớn"))
    elif category == "nồi cơm điện":
        purpose = (slots.get("usage_purpose") or "").lower()
        if any(k in purpose for k in ("cháo", "chao", "hầm", "ham", "đa năng", "nấu kỹ")):
            s.append(("tech", ("cong_nghe",), 0, 0.8, "công nghệ nấu cao cấp (áp suất/cao tần)"))
    elif category == "quạt các loại":
        purpose = (slots.get("usage_purpose") or "").lower()
        if any(k in purpose for k in ("lớn", "lon", "nhanh", "mát")):
            s.append(("power", ("cong_suat",), +1, 0.8, "công suất cao, làm mát nhanh"))
    elif category == "pc, máy in":
        dt = slots.get("device_type")
        purpose = (slots.get("usage_purpose") or "").lower()
        if dt == "pc_de_ban" and any(k in purpose for k in ("gaming", "game", "đồ họa")):
            s.append(("cpu", ("toc_do_cpu",), +1, 0.8, "CPU nhanh"))
            s.append(("ram", ("ram",), +1, 0.6, "RAM cao"))
        elif dt == "man_hinh":
            if "gaming" in purpose:
                s.append(("resp", ("thoi_gian_dap_ung",), -1, 1.0, "thời gian đáp ứng thấp"))
            if "đồ họa" in purpose or "do hoa" in purpose:
                s.append(("res", ("do_phan_giai",), 0, 1.0, "độ phân giải cao"))
        elif dt == "may_in":
            if "ảnh" in purpose or "anh" in purpose:
                s.append(("qual", ("chat_luong_in", "do_phan_giai"), 0, 1.0, "in nét"))
            s.append(("speed", ("toc_do_in",), +1, 0.6, "tốc độ in cao"))
    # đồng hồ thời trang + Nhóm 2: không thêm tín hiệu kỹ thuật — rerank + rating + quantity_sold
    return s


_RES_ORDER = ["hd", "full hd", "2k", "qhd", "4k", "8k"]
_TECH_ORDER = ["nắp gài", "3d", "cao tần", "áp suất", "tách đường"]


def _signal_value(p: dict, spec_substrings: tuple, direction: int) -> float | None:
    """direction=0: tín hiệu dạng keyword/bậc (trả điểm 0..1 trực tiếp)."""
    specs = p.get("specs") or {}
    val = spec_get(specs, *spec_substrings)
    if val is None:
        return None
    sval = str(val).lower()
    if direction == 0:
        if "do_phan_giai" in spec_substrings[0]:
            for i, k in enumerate(reversed(_RES_ORDER)):
                if k in sval:
                    return (len(_RES_ORDER) - i) / len(_RES_ORDER)
            return 0.3
        if "cong_nghe" in spec_substrings[0]:
            if "bơm nhiệt" in sval or "bom nhiet" in sval:
                return 1.0
            for i, k in enumerate(_TECH_ORDER):
                if k in sval:
                    return (i + 1) / len(_TECH_ORDER)
            return 0.2
        if "nhan_nang_luong" in spec_substrings[0]:
            n = num(sval)
            return (n / 5.0) if n else None
        # keyword tồn tại là được điểm (VD tần số karaoke)
        return 1.0
    return num(sval)


def _dedupe_key(product_name: str) -> str:
    """Chuẩn hoá về "model gốc" — bỏ mã SKU/cấu hình phía sau " - " hoặc
    trong ngoặc (VD "Laptop Dell Inspiron 15 3530 - P16WD22 (i5...)" và
    "... - 71070372 (i5...)" cùng 1 model, khác mã SKU/bundle khuyến mãi).
    Catalog crawl thường liệt kê nhiều SKU của CÙNG 1 model marketing —
    nếu không dedupe, top-3 dễ bị chiếm hết bởi các SKU gần giống nhau,
    khiến "so sánh 3 lựa chọn" không có gì thật sự để so sánh."""
    base = product_name.split(" - ", 1)[0]
    base = base.split("(", 1)[0]
    return base.strip().lower()


def rank(candidates: list[dict], slots: dict, category_label: str | None):
    """Hard filter + scoring → (top3, excluded_note_list).

    candidates: list dict sản phẩm đầy đủ (từ DB) đã gắn rerank_score.
    """
    category = (category_label or "").lower()
    budget = slots.get("budget")

    # 1) Hard filter theo category (không xét budget)
    survivors, rejected = [], []
    for p in candidates:
        reason = hard_filter_category(p, slots, category)
        if reason:
            rejected.append((p, reason))
        else:
            survivors.append(p)

    # 2) Budget filter — nới dần nếu <2 sản phẩm còn lại
    def price_of(p):
        return p["sale_price"] if p["sale_price"] is not None else p["original_price"]

    if budget:
        for factor in (1.0, 1.1, 1.2, 1.3):
            in_budget = [p for p in survivors if price_of(p) <= budget * factor]
            if len(in_budget) >= 2 or factor == 1.3:
                for p in survivors:
                    if p not in in_budget:
                        rejected.append((p, f"giá {price_of(p):,}đ vượt ngân sách"
                                            f" {int(budget):,}đ".replace(",", ".")))
                    elif price_of(p) > budget:
                        p["over_budget"] = True  # "hơi vượt ngân sách" — LLM phải nói rõ
                survivors = in_budget
                break

    # 3) Scoring: rerank (trọng số cao nhất) + rating + quantity_sold + tín hiệu ngành
    signals = _signals_for(category, slots)
    raw: dict[str, dict[str, float]] = {}
    # criteria hiển thị cho frontend (bảng so sánh) — tách riêng khỏi "raw" vì raw
    # đã nhân weight, không phản ánh đúng % thang 1-5 sao; None (thiếu spec) KHÔNG
    # được điền criteria giả, để frontend tự hiển thị "—".
    criteria_map: dict[str, list[dict]] = {p["product_code"]: [] for p in survivors}
    for name, subs, direction, weight, label in signals:
        vals = {p["product_code"]: _signal_value(p, subs, direction) for p in survivors}
        nums_ = [v for v in vals.values() if v is not None]
        if not nums_:
            continue
        lo, hi = min(nums_), max(nums_)
        for p in survivors:
            v = vals[p["product_code"]]
            if v is None:
                norm = 0.0
            elif direction == 0:
                norm = v
            elif hi == lo:
                norm = 0.5
            else:
                norm = (v - lo) / (hi - lo)
                if direction < 0:
                    norm = 1.0 - norm
            raw.setdefault(p["product_code"], {})[label] = norm * weight
            if v is not None:
                display = spec_get(p.get("specs") or {}, *subs)
                rating = max(1, min(5, round(1 + norm * 4)))
                criteria_map[p["product_code"]].append(
                    {"label": label, "value_display": display, "rating": rating})

    reranks = [p.get("rerank_score", 0.0) for p in survivors]
    rlo, rhi = (min(reranks), max(reranks)) if reranks else (0, 0)
    for p in survivors:
        rr = p.get("rerank_score", 0.0)
        rr_norm = 0.5 if rhi == rlo else (rr - rlo) / (rhi - rlo)
        rating_norm = (p["rating"] or 0) / 5.0
        sold_norm = math.log10((p["quantity_sold"] or 0) + 1) / 5.0
        sig = raw.get(p["product_code"], {})
        p["score"] = 2.0 * rr_norm + 0.3 * rating_norm + 0.3 * sold_norm + sum(sig.values())
        p["matched_signals"] = [lbl for lbl, v in sig.items() if v > 0.5]

    survivors.sort(key=lambda p: p["score"], reverse=True)

    # Dedupe theo model gốc — giữ variant điểm cao nhất mỗi model, tránh top-3
    # bị 2-3 SKU của CÙNG 1 model chiếm hết chỗ.
    seen_keys: set[str] = set()
    deduped: list[dict] = []
    for p in survivors:
        key = _dedupe_key(p["product_name"])
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(p)
    survivors = deduped

    top3 = survivors[:3]

    # scores{} cho bảng so sánh frontend — lấy thẳng từ dữ liệu vừa chấm điểm ở
    # trên, KHÔNG tính lại/KHÔNG qua LLM. overall_rank theo thứ tự hiển thị (1-3),
    # không phải thứ hạng toàn bộ survivors.
    for idx, p in enumerate(top3):
        p["scores"] = {
            "overall_rank": idx + 1,
            "hard_filter_passed": True,
            "criteria": criteria_map.get(p["product_code"], []),
        }

    # Lý do loại của 2 sản phẩm sát top (để LLM giải thích "vì sao không chọn X")
    excluded = []
    for p in survivors[3:5]:
        excluded.append({"product_name": p["product_name"],
                         "reason": "điểm phù hợp thấp hơn 3 lựa chọn đầu"})
    for p, reason in rejected[:max(0, 2 - len(excluded))]:
        excluded.append({"product_name": p["product_name"], "reason": reason})

    return top3, excluded
