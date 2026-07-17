import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ColorDiagnostics from './ColorDiagnostics';
import MobilePanelAccess from './MobilePanelAccess';
import MobileUiDiagnostics from './MobileUiDiagnostics';
import RecipeAppIntegration from './RecipeAppIntegration';
import RecipeGenerationEnhancements from './RecipeGenerationEnhancements';
import RecipeSelectionPersistence from './RecipeSelectionPersistence';
import RecipeUiCorrections from './RecipeUiCorrections';
import ZoneEdgeInteractionFix from './ZoneEdgeInteractionFix';
import { installRecipeEdgeFallback } from './utils/recipeEdgeFallback';
import './index.css';

installRecipeEdgeFallback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RecipeSelectionPersistence />
    <RecipeGenerationEnhancements />
    <RecipeUiCorrections />
    <ColorDiagnostics />
    <MobileUiDiagnostics />
    <MobilePanelAccess />
    <ZoneEdgeInteractionFix />
    <RecipeAppIntegration />
  </StrictMode>,
);
