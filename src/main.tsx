import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RecipeAppIntegration from './RecipeAppIntegration';
import RecipeSelectionPersistence from './RecipeSelectionPersistence';
import { installRecipeEdgeFallback } from './utils/recipeEdgeFallback';
import './index.css';

installRecipeEdgeFallback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RecipeSelectionPersistence />
    <RecipeAppIntegration />
  </StrictMode>,
);
