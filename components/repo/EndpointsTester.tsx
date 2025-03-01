"use client"

import { useState, useEffect, useCallback } from "react"
import { useRepoData } from "@/components/repo/RepoDataProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, Plus, X, Code, HelpCircle, AlertTriangle } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CodeMirror } from "@/components/code-mirror"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type Endpoint = {
  path: string
  method: string
  description?: string
  params?: string[]
  body?: boolean
  source?: string
  lineNumber?: number
  pathVariables?: string[]
}

type RequestParam = {
  name: string
  value: string
  required?: boolean
  isPathVariable?: boolean
}

type PathVariable = {
  name: string
  value: string
}

// Hooks personnalisés
function useEndpointDetection(selectedFile: any) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [endpointType, setEndpointType] = useState<"api" | "sdk">("api")
  const [sdkInitialized, setSdkInitialized] = useState(false)
  const [baseApiUrl, setBaseApiUrl] = useState("https://api.xoxno.com")
  const [initializationError, setInitializationError] = useState<string | null>(null)
  const { repoName } = useRepoData()

  // Détection automatique du SDK basée sur le nom du repo
  useEffect(() => {
    if (repoName) {
      const isSDKRepo = repoName.toLowerCase().includes('sdk') || 
                       repoName.toLowerCase().includes('xoxno') ||
                       repoName.toLowerCase().includes('multiversx');
      
      if (isSDKRepo) {
        console.group(`🚀 Détection automatique de SDK pour: ${repoName}`);
        console.log('SDK repository detected:', repoName);
        setEndpointType("sdk");
        console.log('Tentative d\'initialisation automatique avec URL:', baseApiUrl);
        console.groupEnd();
        
        // Initialiser automatiquement le SDK
        initializeSDK(baseApiUrl)
          .then(success => {
            setSdkInitialized(success);
            if (success) {
              console.log('✅ SDK initialized successfully');
              setInitializationError(null);
            } else {
              console.error('❌ Failed to initialize SDK');
              setInitializationError("Échec de l'initialisation du SDK. Veuillez vérifier l'URL de base de l'API.");
            }
          })
          .catch(error => {
            console.error('❌ Error initializing SDK:', error);
            setInitializationError(`Erreur d'initialisation du SDK: ${error.message}`);
            setSdkInitialized(false);
          });
      }
    }
  }, [repoName, baseApiUrl]);

  useEffect(() => {
    if (selectedFile && selectedFile.type === "file" && selectedFile.content) {
      const detectedEndpoints = findEndpointsInFile(selectedFile.content, selectedFile.path)
      
      if (detectedEndpoints.length > 0) {
        const type = detectedEndpoints[0].path.startsWith('/') ? "api" : "sdk";
        setEndpointType(type);
        
        // N'initialiser que si ce n'est pas déjà fait
        if (type === "sdk" && !sdkInitialized && (selectedFile.path.includes("xoxno") || selectedFile.content.includes("XOXNOClient"))) {
          initializeSDK(baseApiUrl)
            .then(success => {
              setSdkInitialized(success);
              if (!success) {
                setInitializationError("Échec de l'initialisation du SDK. Veuillez vérifier l'URL de base de l'API.");
              } else {
                setInitializationError(null);
              }
            })
            .catch(error => {
              setInitializationError(`Erreur d'initialisation du SDK: ${error.message}`);
              setSdkInitialized(false);
            });
        }
      }
      
      setEndpoints(detectedEndpoints)
    }
  }, [selectedFile, baseApiUrl, sdkInitialized])

  const initializeSDK = async (apiUrl: string): Promise<boolean> => {
    try {
      console.group(`🔄 Initialisation du SDK - ${new Date().toISOString()}`);
      console.log(`URL de l'API: ${apiUrl}`);
      
      if (typeof window !== 'undefined') {
        try {
          const startTime = performance.now();
          
          // Initialiser le SDK XOXNO selon la documentation officielle
          const { XOXNOClient } = await import('@xoxno/sdk-js');
          console.log("SDK XOXNO importé avec succès");
          
          // Initialiser le client globalement comme recommandé dans la documentation
          XOXNOClient.init({
            apiUrl: apiUrl
          });
          
          console.log("XOXNOClient initialisé avec succès");
          
          // Vérifier que l'initialisation a fonctionné en créant un module de test
          const { CollectionModule } = await import('@xoxno/sdk-js');
          const testModule = new CollectionModule();
          console.log("Test du module Collection réussi");
          
          const endTime = performance.now();
          console.log(`✅ SDK XOXNO initialisé avec succès en ${(endTime - startTime).toFixed(2)}ms`);
          console.log(`Configuration: URL API = ${apiUrl}`);
          console.groupEnd();
          return true;
        } catch (sdkError: any) {
          console.error("Erreur lors de l'initialisation du SDK:", sdkError);
          throw new Error(`Erreur lors de l'initialisation du SDK: ${sdkError.message || 'Erreur inconnue'}`);
        }
      } else {
        // Environnement serveur, ne peut pas initialiser le SDK côté client
        console.warn("Tentative d'initialisation du SDK dans un environnement serveur. Le SDK ne peut être initialisé que côté client.");
        console.groupEnd();
        return false;
      }
    } catch (error: any) {
      console.group(`❌ Erreur d'initialisation du SDK - ${new Date().toISOString()}`);
      console.error("Détails:", error);
      console.groupEnd();
      throw error;
    }
  }

  return {
    endpoints,
    endpointType,
    sdkInitialized,
    baseApiUrl,
    setBaseApiUrl,
    initializationError,
    initializeSDK: () => initializeSDK(baseApiUrl)
      .then(success => {
        setSdkInitialized(success);
        if (!success) {
          setInitializationError("Échec de l'initialisation du SDK. Veuillez vérifier l'URL de base de l'API.");
        } else {
          setInitializationError(null);
        }
        return success;
      })
      .catch(error => {
        setInitializationError(`Erreur d'initialisation du SDK: ${error.message}`);
        setSdkInitialized(false);
        return false;
      })
  }
}

function useEndpointSelection(
  endpoints: Endpoint[], 
  endpointType: "api" | "sdk", 
  baseApiUrl: string
) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null)
  const [requestParams, setRequestParams] = useState<RequestParam[]>([])
  const [constructedUrl, setConstructedUrl] = useState<string>("")

  // Fonction pour mettre à jour un paramètre
  const updateRequestParam = useCallback((index: number, field: 'name' | 'value', newValue: string) => {
    setRequestParams(prevParams => {
      const newParams = [...prevParams];
      newParams[index][field] = newValue;
      return newParams;
    });
  }, []);

  // Mise à jour de l'URL construite quand les paramètres changent
  useEffect(() => {
    updateConstructedUrl();
  }, [requestParams, selectedEndpoint, baseApiUrl, endpointType]);

  // Fonction pour construire l'URL
  const updateConstructedUrl = useCallback(() => {
    if (!selectedEndpoint) return;
    
    let url = selectedEndpoint.path;
    
    // Remplacer les variables de chemin
    requestParams.forEach(param => {
      if (param.isPathVariable && param.value) {
        const regex = new RegExp(`\\$\\{${param.name}\\}`, 'g');
        url = url.replace(regex, encodeURIComponent(param.value));
      }
    });
    
    // Si c'est un endpoint SDK, ajouter un préfixe d'API
    if (endpointType === "sdk") {
      url = `${baseApiUrl}${url}`;
    }
    
    // Ajouter les paramètres de requête s'il y en a
    const queryParams = requestParams
      .filter(param => !param.isPathVariable && param.name.trim() !== "" && param.value.trim() !== "")
      .map(param => `${encodeURIComponent(param.name)}=${encodeURIComponent(param.value)}`)
      .join("&");
    
    if (queryParams) {
      url += (url.includes('?') ? '&' : '?') + queryParams;
    }
    
    setConstructedUrl(url);
  }, [selectedEndpoint, requestParams, endpointType, baseApiUrl]);

  // Sélection d'un endpoint
  const handleEndpointSelection = useCallback((value: string) => {
    const [method, ...pathParts] = value.split("-");
    const path = pathParts.join("-");
    const endpointBasic = { method, path } as Endpoint;
    
    // Trouver l'endpoint complet avec ses metadonnées
    const fullEndpoint = endpoints.find(e => e.method === method && e.path === path) || endpointBasic;
    
    setSelectedEndpoint(fullEndpoint);
    
    // Générer des paramètres suggérés qui incluent les variables de chemin
    const suggestedParams = generateSuggestedParams(fullEndpoint);
    setRequestParams(suggestedParams);
  }, [endpoints]);

  return {
    selectedEndpoint,
    requestParams,
    constructedUrl,
    updateRequestParam,
    handleEndpointSelection
  }
}

function useApiRequest() {
  const [responseData, setResponseData] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [responseStatus, setResponseStatus] = useState("")
  const [responseDetails, setResponseDetails] = useState<Record<string, any> | null>(null)

  const sendRequest = useCallback(async (url: string, method: string, headers: Record<string, string> = {}, body?: string) => {
    setIsLoading(true)
    setResponseData("")
    setResponseStatus("")
    setResponseDetails(null)
    
    try {
      console.group(`📡 Requête API - ${new Date().toISOString()}`);
      console.log(`URL: ${url}`);
      console.log(`Méthode: ${method}`);
      console.log(`En-têtes:`, headers);
      if (body) console.log(`Corps:`, body);
      
      // Pour les endpoints SDK, utiliser directement les méthodes du SDK
      if (url.includes('api.xoxno.com') || url.includes('/nfts/') || url.includes('/collection/')) {
        try {
          console.log("Utilisation du SDK XOXNO");
          
          // Extraire le chemin et les paramètres de l'URL
          const urlObj = new URL(url);
          const path = urlObj.pathname;
          
          // Préparer les paramètres communs
          const startTime = performance.now();
          let result;
          
          // Déterminer quel module et quelle méthode utiliser
          if (path.includes('/nfts/getDailyTrending')) {
            // Utiliser le module NFT pour getDailyTrending
            try {
              console.log("Utilisation du module NFT pour getDailyTrending");
              
              // Extraire les paramètres
              const params = Object.fromEntries(new URLSearchParams(urlObj.search).entries());
              
              // Utiliser le SDK réel
              const { NFTModule } = await import('@xoxno/sdk-js');
              const nftModule = new NFTModule();
              console.log("Module NFT importé depuis SDK réel");
              
              // Appeler directement la méthode du SDK au lieu de construire une URL
              console.log(`Appel SDK: nftModule.getDailyTrending(${JSON.stringify(params)})`);
              result = await nftModule.getDailyTrending();
            } catch (e) {
              throw new Error(`Erreur lors de l'appel à getDailyTrending: ${e instanceof Error ? e.message : String(e)}`);
            }
          } else if (path.includes('/nft/search/query')) {
            try {
              console.log("Utilisation du module NFT pour search");
              
              // Extraire les paramètres
              const params = Object.fromEntries(new URLSearchParams(urlObj.search).entries());
              
              // Utiliser le SDK réel
              const { NFTModule } = await import('@xoxno/sdk-js');
              const nftModule = new NFTModule();
              console.log("Module NFT importé depuis SDK réel");
              
              // Appeler directement la méthode du SDK
              console.log(`Appel SDK: nftModule.search(${JSON.stringify(params)})`);
              result = await nftModule.search(params);
            } catch (e) {
              throw new Error(`Erreur lors de l'appel à search: ${e instanceof Error ? e.message : String(e)}`);
            }
          } else if (path.includes('/collection/')) {
            // Utiliser le module Collection
            try {
              console.log("Utilisation du module Collection");
              
              // Utiliser le SDK réel
              const { CollectionModule } = await import('@xoxno/sdk-js');
              const collection = new CollectionModule();
              console.log("Module Collection importé depuis SDK réel");
              
              if (path.includes('/profile')) {
                // Extraire l'identifiant de collection
                const collectionId = path.split('/collection/')[1].split('/profile')[0];
                console.log(`Appel SDK: collection.getCollectionProfile('${collectionId}')`);
                result = await collection.getCollectionProfile(collectionId);
              } else if (path.includes('/floor-price')) {
                // Extraire l'identifiant de collection
                const collectionId = path.split('/collection/')[1].split('/floor-price')[0];
                // Extraire les paramètres de requête
                const params = new URLSearchParams(urlObj.search);
                const token = params.get('token') || 'EGLD';
                console.log(`Appel SDK: collection.getFloorPrice('${collectionId}', '${token}')`);
                result = await (collection as any).getFloorPrice(collectionId, token);
              } else {
                throw new Error(`Endpoint de collection non pris en charge: ${path}`);
              }
            } catch (e) {
              throw new Error(`Erreur lors de l'appel au module Collection: ${e instanceof Error ? e.message : String(e)}`);
            }
          } else {
            throw new Error(`Type d'endpoint non pris en charge: ${path}`);
          }
          
          const endTime = performance.now();
          const duration = (endTime - startTime).toFixed(2);
          
          setResponseData(JSON.stringify(result, null, 2));
          setResponseStatus(`200 OK`);
          setResponseDetails({
            url: url,
            status: 200,
            statusText: "OK",
            headers: { "content-type": "application/json" },
            duration: `${duration}ms`,
          });
          
          console.log(`Réponse SDK reçue en ${duration}ms`);
          console.log(`Contenu:`, result);
          console.log(`Requête réussie ✅`);
          console.groupEnd();
          setIsLoading(false);
          return;
        } catch (sdkError: any) {
          console.warn("Échec de l'utilisation du SDK, fallback sur fetch:", sdkError);
          // Continuer avec la méthode fetch standard ci-dessous
        }
      }
      
      // Options de la requête
      const options: RequestInit = {
        method,
        headers,
        credentials: "include",
        cache: "no-store",
        next: { revalidate: 0 }
      }
      
      // Ajouter le corps pour les méthodes qui le supportent
      if (["POST", "PUT", "PATCH"].includes(method) && body?.trim()) {
        options.body = body
      }
      
      console.log('Envoi de la requête...');
      const startTime = performance.now();
      
      // Envoyer la requête
      const response = await fetch(url, options)
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      
      console.log(`Réponse reçue en ${duration}ms`);
      console.log(`Statut: ${response.status} ${response.statusText}`);
      
      // Collecter les détails de la réponse pour le débogage
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      console.log('En-têtes de réponse:', responseHeaders);
      
      setResponseDetails({
        url: url,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        duration: `${duration}ms`
      });
      
      // Définir le statut de la réponse
      setResponseStatus(`${response.status} ${response.statusText}`)
      
      // Récupérer les données de la réponse
      let responseText = ""
      const contentType = response.headers.get('content-type');
      console.log(`Type de contenu: ${contentType || 'non spécifié'}`);
      
      if (contentType && contentType.includes('application/json')) {
        try {
          const responseJson = await response.json()
          responseText = JSON.stringify(responseJson, null, 2)
          console.log('Contenu JSON reçu:', responseJson);
        } catch (e) {
          responseText = await response.text()
          console.warn('Erreur lors du parsing JSON, contenu texte récupéré');
        }
      } else {
        responseText = await response.text()
        console.log(`Contenu texte reçu (${responseText.length} caractères)`);
      }
      
      // Ne pas afficher le HTML en cas d'erreur
      if (responseText.startsWith('<!DOCTYPE html>') || responseText.startsWith('<html>')) {
        console.warn('Réponse HTML détectée, ne sera pas affichée');
        setResponseData("La réponse est au format HTML et ne sera pas affichée")
      } else {
        setResponseData(responseText)
      }
      
      console.log(`Requête ${response.ok ? 'réussie ✅' : 'échouée ❌'}`);
      console.groupEnd();
    } catch (error) {
      console.group(`❌ Erreur lors de la requête API - ${new Date().toISOString()}`);
      console.error("Détails:", error);
      setResponseData(`Erreur: ${error instanceof Error ? error.message : String(error)}`)
      setResponseStatus("Error")
      setResponseDetails({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      console.groupEnd();
    } finally {
      setIsLoading(false)
    }
  }, []);

  return {
    responseData,
    isLoading,
    responseStatus,
    responseDetails,
    sendRequest
  }
}

// Fonction utilitaire pour obtenir le numéro de ligne à partir d'un index dans le texte
const getLineNumber = (text: string, index: number): number => {
  return text.substring(0, index).split('\n').length;
};

// Fonctions utilitaires
const findEndpointsInFile = (content: string, path: string): Endpoint[] => {
  const detectedEndpoints: Endpoint[] = []
  
  // Vérifier si c'est un fichier de routes NextJS
  if (path.includes("/app/api/") || path.includes("/pages/api/")) {
    // Chercher les définitions de routes dans les fichiers API NextJS
    const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"]
    
    for (const method of httpMethods) {
      const regex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`, "g")
      if (regex.test(content)) {
        const routePath = path.replace(/\.(js|ts)x?$/, "")
          .replace(/\/route$/, "")
          .replace(/^.*\/app\/api/, "/api")
          .replace(/^.*\/pages\/api/, "/api")
          .replace(/\/\[([^\]]+)\]/g, "/:$1")
        
        detectedEndpoints.push({
          path: routePath,
          method: method
        })
      }
    }
    
    // Si c'est un fichier 'route.js/ts', chercher les méthodes handler
    if (path.includes("/route.")) {
      const routePath = path.replace(/\.(js|ts)x?$/, "")
        .replace(/\/route$/, "")
        .replace(/^.*\/app\/api/, "/api")
        .replace(/\/\[([^\]]+)\]/g, "/:$1")
      
      for (const method of httpMethods) {
        const regex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`, "g")
        if (regex.test(content)) {
          detectedEndpoints.push({
            path: routePath,
            method: method
          })
        }
      }
    }
  }
  
  // Détection des endpoints dans des modules SDK
  if (path.endsWith('.ts') || path.endsWith('.js')) {
    // Recherche de méthodes qui font des appels API via fetchWithTimeout ou fetch
    const apiMethodRegex = /(?:public|private)?\s+(\w+)\s*=\s*async\s*\(\s*([^)]*)\)\s*(?::\s*Promise<[^>]+>)?\s*=>\s*\{[\s\S]*?(?:this\.api\.fetchWithTimeout|fetch)\s*<[^>]*>\s*\(\s*['"`](\/[^'"`]+)['"`]/g;
    
    let match;
    while ((match = apiMethodRegex.exec(content)) !== null) {
      const methodName = match[1];
      const parameters = match[2];
      let endpoint = match[3];
      
      // Déterminer la méthode HTTP en fonction du nom de la méthode
      let httpMethod = "GET";
      if (methodName.toLowerCase().includes('post')) httpMethod = "POST";
      else if (methodName.toLowerCase().includes('put')) httpMethod = "PUT";
      else if (methodName.toLowerCase().includes('delete')) httpMethod = "DELETE";
      else if (methodName.toLowerCase().includes('patch')) httpMethod = "PATCH";
      
      // Ajouter l'endpoint détecté
      detectedEndpoints.push({
        path: endpoint,
        method: httpMethod,
        description: `SDK Method: ${methodName}(${parameters})`,
        source: path,
        lineNumber: getLineNumber(content, match.index)
      });
    }
    
    // Détection spécifique du SDK XOXNO
    if (content.includes('XOXNOClient') || path.includes('xoxno') || path.includes('XOXNO')) {
      // Recherche des méthodes d'API XOXNO spécifiques
      const xoxnoMethodRegex = /(?:public|private)?\s+(\w+)\s*=?\s*(?:async)?\s*\(([^)]*)\)/g;
      
      while ((match = xoxnoMethodRegex.exec(content)) !== null) {
        const methodName = match[1];
        const parameters = match[2];
        
        // Ignorer les constructeurs et méthodes privées/internes
        if (methodName === 'constructor' || methodName.startsWith('_')) continue;
        
        // Déterminer le chemin d'endpoint en fonction du module et de la méthode
        let endpoint = '';
        if (path.includes('NFTModule') || path.toLowerCase().includes('nft')) {
          if (methodName === 'getDailyTrending') {
            endpoint = '/nfts/getDailyTrending';
          } else if (methodName === 'search') {
            endpoint = '/nft/search/query';
          }
        } else if (path.includes('CollectionModule') || path.toLowerCase().includes('collection')) {
          if (methodName === 'getCollectionProfile') {
            endpoint = '/collection/${collectionId}/profile';
          } else if (methodName === 'getFloorPrice') {
            endpoint = '/collection/${collectionId}/floor-price';
          }
        }
        
        // Si un endpoint a été déterminé, l'ajouter à la liste
        if (endpoint) {
          // Extraire les variables de chemin de l'endpoint
          const pathVariables = [];
          const pathVarRegex = /\$\{([^}]+)\}/g;
          let pathVarMatch;
          while ((pathVarMatch = pathVarRegex.exec(endpoint)) !== null) {
            pathVariables.push(pathVarMatch[1]);
          }
          
          detectedEndpoints.push({
            path: endpoint,
            method: 'GET',
            description: `XOXNO SDK: ${methodName}(${parameters})`,
            source: path,
            lineNumber: getLineNumber(content, match.index),
            pathVariables: pathVariables.length > 0 ? pathVariables : undefined
          });
        }
      }
    }
  }
  
  return detectedEndpoints;
}

const generateSuggestedParams = (endpoint: Endpoint): RequestParam[] => {
  const params: RequestParam[] = [];
  
  // Ajouter d'abord les variables de chemin comme paramètres
  if (endpoint.pathVariables && endpoint.pathVariables.length > 0) {
    for (const varName of endpoint.pathVariables) {
      params.push({ 
        name: varName, 
        value: "", 
        required: true,
        isPathVariable: true 
      });
    }
  }
  
  // Si c'est un SDK endpoint et qu'il a des paramètres déterminés
  if (endpoint.params && endpoint.params.length > 0) {
    for (const param of endpoint.params) {
      if (param !== 'this' && param !== 'args' && !param.includes('{')) {
        // Vérifier si ce paramètre n'est pas déjà dans la liste (pour éviter les doublons)
        if (!params.some(p => p.name === param)) {
          params.push({ name: param, value: "", required: true });
        }
      }
    }
  }
  
  // Ajouter des paramètres courants selon l'URL
  if (endpoint.path.includes('?')) {
    // Extraire les paramètres déjà dans l'URL
    const urlParams = new URLSearchParams(endpoint.path.split('?')[1]);
    urlParams.forEach((value, key) => {
      // Éviter les doublons avec les variables de chemin
      if (!params.some(p => p.name === key)) {
        params.push({ name: key, value, required: true });
      }
    });
  }
  
  // Ajouter des paramètres suggérés selon le type d'endpoint
  if (endpoint.path.includes('/query') || endpoint.path.includes('/search')) {
    if (!params.some(p => p.name === 'top')) {
      params.push({ name: 'top', value: '10', required: true });
    }
    if (!params.some(p => p.name === 'skip')) {
      params.push({ name: 'skip', value: '0', required: true });
    }
  }
  
  return params;
}

// Sous-composants
function SdkInitializer({ baseApiUrl, setBaseApiUrl, sdkInitialized, initializationError, initializeSdk }: {
  baseApiUrl: string;
  setBaseApiUrl: (url: string) => void;
  sdkInitialized: boolean;
  initializationError: string | null;
  initializeSdk: () => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-2">
          <label className="text-sm font-medium mb-1 block">
            API Base URL:
          </label>
          <Input 
            value={baseApiUrl}
            onChange={(e) => setBaseApiUrl(e.target.value)}
            placeholder="https://api.xoxno.com"
          />
        </div>
        <div className="flex-none mt-6">
          <Button 
            onClick={initializeSdk}
            variant={sdkInitialized ? "outline" : "default"}
            size="sm"
          >
            {sdkInitialized ? "Réinitialiser SDK" : "Initialiser SDK"}
          </Button>
        </div>
      </div>
      {!sdkInitialized && (
        <Alert className="mt-2" variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>SDK non initialisé</AlertTitle>
          <AlertDescription>
            Le SDK doit être initialisé avant de pouvoir effectuer des requêtes. Initialisez-le ou certaines requêtes pourraient échouer.
            {initializationError && (
              <p className="mt-1 text-xs">{initializationError}</p>
            )}
          </AlertDescription>
        </Alert>
      )}
      {sdkInitialized && (
        <Alert className="mt-2" variant="default">
          <AlertDescription>
            SDK initialisé avec succès. Vous pouvez maintenant effectuer des requêtes.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function EndpointSelector({ endpoints, selectedValue, onValueChange }: {
  endpoints: Endpoint[];
  selectedValue: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium block">
          Select an endpoint
        </label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <HelpCircle size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" align="end" className="max-w-sm">
              <div className="space-y-1 text-xs">
                <p><strong>Endpoint Type: {endpoints.length > 0 && endpoints[0].path.startsWith('/') ? 'API Route' : 'SDK Method'}</strong></p>
                <p>
                  {endpoints.length > 0 && endpoints[0].path.startsWith('/') 
                    ? "This file contains Next.js API routes that can be directly called." 
                    : "This file contains SDK methods that make API calls. Tests will be directed to the actual API endpoints."}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Interface de sélection en deux colonnes avec scrollbar */}
      <div className="border rounded-md overflow-hidden">
        <div className="max-h-96 overflow-y-auto p-1">
          <div className="grid grid-cols-2 gap-3">
            {endpoints.map((endpoint, index) => (
              <div 
                key={index}
                onClick={() => onValueChange(`${endpoint.method}-${endpoint.path}`)}
                className={`
                  p-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors
                  ${selectedValue === `${endpoint.method}-${endpoint.path}` ? 'bg-muted border-2 border-primary/50' : 'border border-muted/50'}
                `}
              >
                <div className="flex items-start gap-2">
                  <span className={`
                    inline-block px-2 py-0.5 text-xs font-medium rounded shrink-0
                    ${endpoint.method === 'GET' ? 'bg-green-100 text-green-800' : ''}
                    ${endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' : ''}
                    ${endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' : ''}
                    ${endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' : ''}
                    ${endpoint.method === 'PATCH' ? 'bg-purple-100 text-purple-800' : ''}
                  `}>
                    {endpoint.method}
                  </span>
                  <span className="break-all text-sm leading-tight">{endpoint.path}</span>
                </div>
                {endpoint.description && (
                  <div className="text-xs text-muted-foreground mt-1.5 ml-0 leading-tight">
                    {endpoint.source ? (
                      <span className="font-medium">{endpoint.source}: </span>
                    ) : ""}
                    {endpoint.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Affichage de l'endpoint sélectionné */}
      {selectedValue && (
        <div className="mt-2 text-sm">
          <span className="text-muted-foreground">Selected: </span>
          <span className="font-medium">
            {endpoints.find(e => `${e.method}-${e.path}` === selectedValue)?.path || selectedValue}
          </span>
        </div>
      )}
    </div>
  );
}

function ParametersEditor({ params, updateParam }: {
  params: RequestParam[];
  updateParam: (index: number, field: 'name' | 'value', value: string) => void;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium mb-2">Parameters</h3>
      <div className="space-y-4">
        {params.map((param, index) => (
          <div key={index} className="flex gap-2 items-center">
            <Input
              placeholder="Parameter name"
              value={param.name}
              onChange={(e) => updateParam(index, 'name', e.target.value)}
              className="flex-1"
              readOnly={param.required}
            />
            <Input
              placeholder="Value"
              value={param.value}
              onChange={(e) => updateParam(index, 'value', e.target.value)}
              className={`flex-1 ${param.isPathVariable ? 'border-blue-300' : ''}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ResponseViewer({ status, data, details }: {
  status: string;
  data: string;
  details: Record<string, any> | null;
}) {
  if (!status) return null;
  
  const isError = status.startsWith('4') || status.startsWith('5') || status === 'Error';
  
  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">Response</h3>
        <div className={`
          px-2 py-0.5 text-xs font-medium rounded
          ${status.startsWith('2') ? 'bg-green-100 text-green-800' : ''}
          ${status.startsWith('4') ? 'bg-yellow-100 text-yellow-800' : ''}
          ${status.startsWith('5') || status === 'Error' ? 'bg-red-100 text-red-800' : ''}
        `}>
          {status}
        </div>
      </div>
      
      {isError && details && (
        <Alert className="mb-2" variant="destructive">
          <AlertTitle>Détails de l'erreur</AlertTitle>
          <AlertDescription className="text-xs">
            <div className="space-y-1 mt-1">
              {details.url && <div><strong>URL:</strong> {details.url}</div>}
              {details.status && <div><strong>Status:</strong> {details.status} {details.statusText}</div>}
              {details.error && <div><strong>Erreur:</strong> {details.error}</div>}
              {details.headers && (
                <div>
                  <strong>En-têtes:</strong>
                  <pre className="mt-1 p-1 bg-muted rounded text-[10px] max-h-20 overflow-auto">
                    {JSON.stringify(details.headers, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="border rounded-md overflow-hidden bg-muted/20">
        <div className="h-60 overflow-auto">
          <CodeMirror
            value={data}
            height="100%"
            filename={data.startsWith('{') ? "response.json" : "response.txt"}
          />
        </div>
      </div>
    </div>
  );
}

// Composant principal
export function EndpointsTester() {
  const { selectedFile } = useRepoData()
  
  // Utiliser les hooks personnalisés
  const { 
    endpoints, 
    endpointType, 
    sdkInitialized, 
    baseApiUrl, 
    setBaseApiUrl,
    initializationError,
    initializeSDK 
  } = useEndpointDetection(selectedFile);
  
  const { 
    selectedEndpoint, 
    requestParams, 
    constructedUrl, 
    updateRequestParam, 
    handleEndpointSelection 
  } = useEndpointSelection(endpoints, endpointType, baseApiUrl);
  
  const { 
    responseData, 
    isLoading, 
    responseStatus,
    responseDetails,
    sendRequest 
  } = useApiRequest();
  
  // Préparation et envoi de la requête
  const handleSendRequest = useCallback(() => {
    if (!selectedEndpoint || !constructedUrl) return;
    
    console.group(`🚀 Envoi de requête à l'endpoint ${selectedEndpoint.method} ${selectedEndpoint.path}`);
    console.log('URL construite:', constructedUrl);
    console.log('Paramètres:', requestParams);
    console.groupEnd();
    
    // Construire les en-têtes
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    
    // Envoyer la requête
    sendRequest(constructedUrl, selectedEndpoint.method, headers);
  }, [selectedEndpoint, constructedUrl, requestParams, sendRequest]);

  return (
    <div className="rounded-lg border bg-background shadow-sm">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Endpoints Tester</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Test {endpoints.length} endpoints found in the {selectedFile?.path || "selected"} file
        </p>
      </div>
      
      {endpoints.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">
            {selectedFile ? 
              "No API endpoints found in this file. Select a file that contains API routes or SDK methods." : 
              "Select a file to detect API endpoints"
            }
          </p>
        </div>
      ) : (
        <div className="p-4">
          {/* SDK Initializer */}
          {endpointType === "sdk" && (
            <SdkInitializer
              baseApiUrl={baseApiUrl}
              setBaseApiUrl={setBaseApiUrl}
              sdkInitialized={sdkInitialized}
              initializationError={initializationError}
              initializeSdk={initializeSDK}
            />
          )}
          
          {/* Endpoint Selector */}
          <EndpointSelector
            endpoints={endpoints}
            selectedValue={selectedEndpoint ? `${selectedEndpoint.method}-${selectedEndpoint.path}` : ""}
            onValueChange={handleEndpointSelection}
          />
          
          {/* Selected Endpoint UI */}
          {selectedEndpoint && (
            <>
              {/* URL Preview */}
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Request URL</h3>
                <div className="p-3 bg-muted/20 border rounded-md overflow-x-auto">
                  <code className="text-xs font-mono whitespace-nowrap">
                    <span className="text-blue-600 font-semibold">{selectedEndpoint.method}</span> {constructedUrl}
                  </code>
                </div>
              </div>
              
              {/* Parameters Editor */}
              <ParametersEditor 
                params={requestParams}
                updateParam={updateRequestParam}
              />
              
              {/* Send Request Button */}
              <div className="mt-6">
                <Button 
                  onClick={handleSendRequest}
                  disabled={isLoading || (!sdkInitialized && endpointType === "sdk")}
                  className="w-full"
                >
                  {isLoading ? (
                    <>Loading...</>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Send Request
                    </>
                  )}
                </Button>
                {!sdkInitialized && endpointType === "sdk" && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Vous devez initialiser le SDK avant de pouvoir envoyer des requêtes.
                  </p>
                )}
              </div>
              
              {/* Response Viewer */}
              <ResponseViewer 
                status={responseStatus}
                data={responseData}
                details={responseDetails}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
} 