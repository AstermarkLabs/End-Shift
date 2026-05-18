import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profilesRouter from "./profiles";
import rolesRouter from "./roles";
import onboardingRouter from "./onboarding";
import orgUnitsRouter from "./org-units";
import checklistsRouter from "./checklists";
import shiftsRouter from "./shifts";
import pdfImportRouter from "./pdf-import";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/profiles", profilesRouter);
router.use("/roles", rolesRouter);
router.use("/onboarding", onboardingRouter);
router.use("/org-units", orgUnitsRouter);
router.use(pdfImportRouter);
router.use(checklistsRouter);
router.use(shiftsRouter);

export default router;
