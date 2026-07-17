import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ColorDiagnostics from './ColorDiagnostics';
import RecipeAppIntegration from './RecipeAppIntegration';
import RecipeGenerationEnhancements from './RecipeGenerationEnhancements';
import RecipeSelectionPersistence from './RecipeSelectionPersistence';
import RecipeUiCorrections from './RecipeUiCorrections';
import ZoneEdgeInteractionFix from './ZoneEdgeInteractionFix';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { installRecipeEdgeFallback } from './utils/recipeEdgeFallback';
import './index.css';

installRecipeEdgeFallback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceTabs />
    <RecipeSelectionPersistence />
    <RecipeGenerationEnhancements />
    <RecipeUiCorrections />
    <ColorDiagnostics />
    <ZoneEdgeInteractionFix />
    <RecipeAppIntegration />
  </StrictMode>,
);
