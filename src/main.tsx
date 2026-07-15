import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RecipeAppIntegration from './RecipeAppIntegration';
import RecipeGenerationEnhancements from './RecipeGenerationEnhancements';
import RecipeSelectionPersistence from './RecipeSelectionPersistence';
import RecipeUiCorrections from './RecipeUiCorrections';
import { installRecipeEdgeFallback } from './utils/recipeEdgeFallback';
import './index.css';

installRecipeEdgeFallback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RecipeSelectionPersistence />
    <RecipeGenerationEnhancements />
    <RecipeUiCorrections />
    <RecipeAppIntegration />
  </StrictMode>,
);
