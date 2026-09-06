import re
from typing import Tuple, Dict, Any

class IndianPlateValidator:
    """Configurable validator and normalizer for Indian License Plates."""

    # Valid Indian State / UT codes
    STATE_CODES = {
        "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DD", "DL", "DN", "GA", "GJ",
        "HR", "HP", "JH", "JK", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML",
        "MZ", "NL", "OD", "PB", "PY", "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "WB"
    }

    # Character confusion mappings
    NUM_TO_CHAR = {
        '0': 'O',
        '1': 'I',
        '8': 'B',
        '5': 'S',
        '2': 'Z'
    }

    CHAR_TO_NUM = {
        'O': '0',
        'Q': '0',
        'D': '0',
        'I': '1',
        'L': '1',
        'B': '8',
        'S': '5',
        'Z': '2',
        'A': '4'
    }

    # Regular expressions for Indian Plates
    # 1. Standard: 2 letters (state) + 1-2 digits (RTO) + 1-3 letters (series) + 4 digits (number)
    # E.g.: DL01AB1234, HR26DK4521, MH12RN8890, UP16BT9021, DL3CAA1234
    REGEX_STANDARD = re.compile(r"^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{4})$")

    # 2. Older / alternate: 2 letters + 1-2 digits + 1-4 digits (e.g. DL1C1234, HR021234)
    REGEX_LEGACY = re.compile(r"^([A-Z]{2})([0-9]{1,2})([A-Z]{0,2})([0-9]{1,4})$")

    # 3. Bharat Series: 2 digits (year) + BH + 4 digits + 2 letters (e.g. 22BH1234AA)
    REGEX_BHARAT = re.compile(r"^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$")

    @classmethod
    def clean_text(cls, text: str) -> str:
        """Remove whitespace, hyphens, dots, and convert to uppercase."""
        if not text:
            return ""
        # Remove non-alphanumeric
        cleaned = re.sub(r"[^A-Za-z0-9]", "", text).upper()
        return cleaned

    @classmethod
    def normalize_plate(cls, raw_text: str) -> Tuple[str, bool, float]:
        """
        Normalize raw OCR text to standard Indian plate format using positional confusion rules.
        Returns (normalized_plate, is_valid_format, confidence_modifier)
        """
        cleaned = cls.clean_text(raw_text)
        if not cleaned:
            return "", False, 0.0

        # Direct check
        if cls.REGEX_STANDARD.match(cleaned):
            state = cleaned[:2]
            is_valid_state = state in cls.STATE_CODES
            return cleaned, True, 1.0 if is_valid_state else 0.9

        if cls.REGEX_BHARAT.match(cleaned):
            return cleaned, True, 0.95

        # Heuristic: Check if a known state code exists within the first 3 characters
        # (e.g. "HHR26DK4521" -> "HR26DK4521", "INDDL01AB1234" -> "DL01AB1234", "IHR26DK4521" -> "HR26DK4521")
        for state in cls.STATE_CODES:
            idx = cleaned.find(state)
            if 0 < idx <= 3:
                sub = cleaned[idx:]
                if 8 <= len(sub) <= 10:
                    sub_norm, sub_valid, sub_conf = cls._normalize_candidate(sub)
                    if sub_valid:
                        return sub_norm, True, sub_conf

        return cls._normalize_candidate(cleaned)

    @classmethod
    def _normalize_candidate(cls, cleaned: str) -> Tuple[str, bool, float]:
        """Positional confusion correction for a cleaned string."""
        chars = list(cleaned)
        length = len(chars)

        if length == 10:
            # Pos 0, 1: must be State letters
            for i in [0, 1]:
                if chars[i] in cls.NUM_TO_CHAR:
                    chars[i] = cls.NUM_TO_CHAR[chars[i]]

            # Pos 2, 3: must be RTO digits
            for i in [2, 3]:
                if chars[i] in cls.CHAR_TO_NUM:
                    chars[i] = cls.CHAR_TO_NUM[chars[i]]

            # Pos 4, 5: must be Series letters
            for i in [4, 5]:
                if chars[i] in cls.NUM_TO_CHAR:
                    chars[i] = cls.NUM_TO_CHAR[chars[i]]

            # Pos 6, 7, 8, 9: must be 4 registration digits
            for i in [6, 7, 8, 9]:
                if chars[i] in cls.CHAR_TO_NUM:
                    chars[i] = cls.CHAR_TO_NUM[chars[i]]

            candidate = "".join(chars)
            if cls.REGEX_STANDARD.match(candidate):
                state = candidate[:2]
                return candidate, True, 0.95 if state in cls.STATE_CODES else 0.85

        elif length == 9:
            # e.g. DL1AB1234 (1-digit RTO) or DL01A1234 (1-letter series)
            candidate_list = list(chars)
            for i in [0, 1]:
                if candidate_list[i] in cls.NUM_TO_CHAR:
                    candidate_list[i] = cls.NUM_TO_CHAR[candidate_list[i]]
            for i in range(len(candidate_list) - 4, len(candidate_list)):
                if candidate_list[i] in cls.CHAR_TO_NUM:
                    candidate_list[i] = cls.CHAR_TO_NUM[candidate_list[i]]
            candidate = "".join(candidate_list)
            if cls.REGEX_STANDARD.match(candidate) or cls.REGEX_LEGACY.match(candidate):
                return candidate, True, 0.88

        # Fallback
        is_legacy = bool(cls.REGEX_LEGACY.match(cleaned))
        return cleaned, is_legacy, 0.75 if is_legacy else 0.50

    @classmethod
    def validate(cls, raw_ocr: str) -> Dict[str, Any]:
        """Comprehensive validation pipeline returning structured dictionary."""
        cleaned = cls.clean_text(raw_ocr)
        normalized, is_valid, conf_mod = cls.normalize_plate(cleaned)
        
        # Determine state
        state_code = normalized[:2] if len(normalized) >= 2 else ""
        recognized_state = state_code in cls.STATE_CODES

        return {
            "raw_ocr": raw_ocr,
            "cleaned": cleaned,
            "normalized_plate": normalized,
            "is_valid_format": is_valid,
            "recognized_state": recognized_state,
            "state_code": state_code if recognized_state else None,
            "confidence_modifier": conf_mod
        }

