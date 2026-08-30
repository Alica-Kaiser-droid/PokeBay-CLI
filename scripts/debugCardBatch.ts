import { CardBatchService } from "./CardBatchService.js";

console.log("CardBatchService:", CardBatchService);

console.log(
  "Prototype Methoden:",
  Object.getOwnPropertyNames(CardBatchService.prototype)
);

const service = new CardBatchService("de");

console.log(
  "Instance:",
  service
);

console.log(
  "typeof processBatch:",
  typeof service.processBatch
);

console.log(
  "typeof processBatchOfMax50:",
  typeof service.processBatchOfMax50
);
