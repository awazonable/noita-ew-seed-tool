test:
	node tests/perk.test.js

serve:
	python3 -m http.server 8101

.PHONY: test serve
