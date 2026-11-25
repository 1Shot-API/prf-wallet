import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("OwsSignerFrontendModule", (m) => {
  const frontend = m.contract("OwsSignerFrontend");
  return { frontend };
});
