test:
	node tests/perk.test.js
	node tests/search-conditions.test.js
	node tests/search-engine.test.js

serve:
	python3 -m http.server 8101

.PHONY: test serve
