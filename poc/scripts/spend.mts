// Prints total spend against the cap (saved runs + archived spend of deleted runs + smoke tests).
import { budgetUsd, spentUsd } from "../src/lib/store";
console.log(`spent $${(await spentUsd()).toFixed(2)} of $${budgetUsd()}`);
