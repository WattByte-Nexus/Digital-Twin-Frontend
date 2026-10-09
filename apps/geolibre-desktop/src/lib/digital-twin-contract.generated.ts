// Generated from the pinned Digital Twin Engine OpenAPI. Do not edit.
// Engine revision: c4f3df8456f88f3ac22c25343a6ecb259eb3d284; schema SHA-256: aec155c6dab8306db44d85cd11c35f8dbd9b7682e52bff39309c11ab60ed4ec8

export interface paths {
    "/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Check API readiness
         * @description Report whether the API role completed startup validation.
         *
         *     Serves both the base URL and the versioned readiness probe using the same
         *     runtime state. Request middleware logs calls to both entry points.
         *
         *     FastAPI publishes readiness after its role checks Redis, starts its broker
         *     and constructs configured stores and grid metadata. Numerical workers and
         *     weather polling run in a separate process; this flag does not continuously
         *     probe that process or external source freshness.
         *
         *     Args:
         *         readiness: API-runtime state resolved from FastAPI application state.
         *
         *     Returns:
         *         A ``ready`` status after successful API startup.
         *
         *     Raises:
         *         HTTPException: If a published runtime explicitly reports itself as not
         *             ready. A missing runtime is rejected by the dependency resolver.
         */
        get: operations["get_readiness__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/data-sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List configured data sources
         * @description Return safe summaries of configured weather and static sources.
         *
         *     Args:
         *         catalog: Runtime-owned configured-source reader.
         *         request: Hosting context used to scope source collection members.
         *
         *     Returns:
         *         Deterministically ordered source summaries without private config.
         */
        get: operations["list_data_sources_api_v1_data_sources_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Check process liveness
         * @description Report that the FastAPI process can serve an HTTP response.
         *
         *     Returns:
         *         A process-local ``live`` status. This probe performs no Engine, Redis,
         *         filesystem, or model checks.
         */
        get: operations["get_liveness_api_v1_health_live_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Check Engine readiness
         * @description Report whether the API role completed startup validation.
         *
         *     Serves both the base URL and the versioned readiness probe using the same
         *     runtime state. Request middleware logs calls to both entry points.
         *
         *     FastAPI publishes readiness after its role checks Redis, starts its broker
         *     and constructs configured stores and grid metadata. Numerical workers and
         *     weather polling run in a separate process; this flag does not continuously
         *     probe that process or external source freshness.
         *
         *     Args:
         *         readiness: API-runtime state resolved from FastAPI application state.
         *
         *     Returns:
         *         A ``ready`` status after successful API startup.
         *
         *     Raises:
         *         HTTPException: If a published runtime explicitly reports itself as not
         *             ready. A missing runtime is rejected by the dependency resolver.
         */
        get: operations["get_readiness_api_v1_health_ready_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/map-layers/{layer_id}/data.json": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a map-layer value at a WGS84 point
         * @description Return one JSON scalar from the same safe layer used by the COG route.
         *
         *     Args:
         *         layer_id: Public catalog identity returned by a descriptor endpoint.
         *         longitude: WGS84 longitude in decimal degrees.
         *         latitude: WGS84 latitude in decimal degrees.
         *         response: Active response used to publish the artifact cache policy.
         *         artifact_service: Runtime-owned generator, catalog, and sampler.
         *
         *     Returns:
         *         A typed scalar reading. ``value`` is ``None`` when the point is outside
         *         the raster extent or maps to nodata.
         *
         *     Raises:
         *         MapLayerArtifactError: If the layer is unknown, its source is not ready,
         *             or the artifact cannot be prepared or sampled. Standard handlers
         *             convert these failures to safe problem details.
         *
         *     Side Effects:
         *         A cache miss dispatches COG generation and raster sampling to a worker
         *         thread and publishes the immutable artifact's cache policy.
         */
        get: operations["get_map_layer_reading_api_v1_map_layers__layer_id__data_json_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/map-layers/{layer_id}/data.tif": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a Cloud Optimized GeoTIFF map layer
         * @description Generate or serve one safe COG with ranges and cache validators.
         *
         *     Args:
         *         layer_id: Public catalog identity returned by a descriptor endpoint.
         *         request: Active request carrying conditional and range headers.
         *         artifact_service: Runtime-owned generator and bounded source catalog.
         *
         *     Returns:
         *         A full or partial TIFF response, or an empty 304 when the caller's
         *         ``If-None-Match`` value matches the prepared artifact.
         *
         *     Raises:
         *         MapLayerArtifactError: If the layer is unknown, its source is not ready,
         *             or a valid COG cannot be generated. Standard API handlers convert
         *             these failures to safe problem details.
         *
         *     Side Effects:
         *         A cache miss dispatches blocking Zarr, raster, and filesystem work to a
         *         worker thread before streaming the resulting local file.
         */
        get: operations["get_map_layer_cog_api_v1_map_layers__layer_id__data_tif_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/point-clouds/{region_id}/{dataset_id}/{version}/{object_path}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read an authenticated immutable point-cloud tile
         * @description Authorize an exact retained publication and stream only its delivery-bucket key.
         *
         *     Args:
         *         region_id: Public region that owns the publication.
         *         dataset_id: Logical dataset with an explicit stored principal grant.
         *         version: Exact ready build identity, including retained older versions.
         *         object_path: Generated JSON or PNTS relative path below that version.
         *         request: Hosting request with a verified ``state.principal_id``.
         *
         *     Returns:
         *         A bounded private stream, an empty HEAD/304 response, or safe 401, 403,
         *         404, 416, or 503. Single byte ranges and ETag conditions are sent to S3.
         *
         *     Side Effects:
         *         Queries Aurora permissions and publication identity before invoking S3.
         *         SDK calls and body reads run outside the event loop; every allocated body
         *         closes on completion or cancellation. No source bucket keys are exposed.
         */
        get: operations["read_point_cloud_tile_api_v1_point_clouds__region_id___dataset_id___version___object_path__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List regions
         * @description Return one cursor-addressed page from the region catalog.
         *
         *     Args:
         *         store: Concrete owning persistence boundary for regions.
         *         request: Hosting context used to filter inaccessible collection members.
         *         cursor: Opaque position returned by the preceding page.
         *         limit: Maximum number of regions to return.
         *
         *     Returns:
         *         A validated page of shared region contracts.
         */
        get: operations["list_regions_api_v1_regions_get"];
        put?: never;
        /**
         * Create a draft region
         * @description Create a draft through the concrete owning region store.
         *
         *     Args:
         *         candidate: Validated client-owned name and geographic bounds.
         *         store: Concrete owning persistence boundary for regions.
         *
         *     Returns:
         *         The store-owned draft region.
         */
        post: operations["create_region_api_v1_regions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a region
         * @description Return one region from its concrete owning store.
         *
         *     Args:
         *         region_id: Stable public identifier for the requested region.
         *         store: Concrete owning persistence boundary for regions.
         *
         *     Returns:
         *         The requested shared region contract.
         */
        get: operations["get_region_api_v1_regions__region_id__get"];
        put?: never;
        post?: never;
        /**
         * Delete a draft region
         * @description Delete an unreferenced draft through the owning region store.
         *
         *     Args:
         *         region_id: Stable public identifier for the draft region.
         *         store: Concrete owning persistence boundary for regions.
         *
         *     Returns:
         *         An empty successful response after deletion.
         */
        delete: operations["delete_region_api_v1_regions__region_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update a draft region
         * @description Apply validated editable fields to an unpublished region draft.
         *
         *     Args:
         *         region_id: Stable public identifier for the draft region.
         *         patch: Validated partial update containing at least one editable field.
         *         store: Concrete owning persistence boundary for regions.
         *
         *     Returns:
         *         The updated draft region.
         */
        patch: operations["update_region_api_v1_regions__region_id__patch"];
        trace?: never;
    };
    "/api/v1/regions/{region_id}/assets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List region assets
         * @description Return deterministic public assets belonging to one region.
         *
         *     Args:
         *         region_id: Stable public identifier for the owning region.
         *         request: Active request containing optional cache validators.
         *         reader: Unified catalog and operational asset projection boundary.
         *
         *     Returns:
         *         Compact JSON bytes for assets ordered by stable public identifier, or
         *         an empty ``304`` response when the client's ETag is current.
         *
         *     Raises:
         *         HTTPException: If the region does not exist or persisted asset state is
         *             corrupt.
         */
        get: operations["list_region_assets_api_v1_regions__region_id__assets_get"];
        put?: never;
        /**
         * Add an asset to a draft region
         * @description Create a server-identified tree or power line in a draft region.
         *
         *     Args:
         *         region_id: Stable public identifier for the draft region.
         *         candidate: Validated client-owned geometry and properties.
         *         response: Mutable response used to publish the resource location.
         *         store: Draft-aware owning asset catalog.
         *
         *     Returns:
         *         The authoritative created asset.
         *
         *     Raises:
         *         HTTPException: If the region is missing, the identity conflicts, the
         *             region is no longer editable, the request is invalid, or persisted
         *             asset state is corrupt.
         *
         *     Side Effects:
         *         Allocates a public identifier, persists the asset, and publishes its
         *         same-origin resource location on success.
         */
        post: operations["create_region_asset_api_v1_regions__region_id__assets_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/assets:batch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add a bounded asset batch to a draft region
         * @description Create up to one thousand server-identified assets in request order.
         *
         *     Args:
         *         region_id: Stable public identifier for the draft region.
         *         candidates: Validated tree or power-line inputs from one source page.
         *         store: Draft-aware owning asset catalog.
         *
         *     Returns:
         *         Authoritative created assets in the same order as the request.
         *
         *     Raises:
         *         HTTPException: If the draft state, geometry, or asset batch is invalid.
         *
         *     Side Effects:
         *         Allocates public identifiers and persists the batch through the store.
         */
        post: operations["create_region_asset_batch_api_v1_regions__region_id__assets_batch_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/assets:csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Import CSV assets into a draft region
         * @description Import a bounded CSV asset batch into one draft region.
         *
         *     Args:
         *         region_id: Stable public identifier for the editable owning region.
         *         file: UTF-8 CSV upload with exactly ``type``, ``properties``, and
         *             ``coords`` columns. ``type`` is ``tree`` or ``power_line``;
         *             ``properties`` is a JSON object for the matching asset schema;
         *             ``coords`` is GeoJSON-order JSON coordinates: ``[longitude,
         *             latitude]`` for a tree or ``[[longitude, latitude], ...]`` for a
         *             power line.
         *         store: Draft-aware owning asset catalog.
         *
         *     Returns:
         *         Authoritative created assets in CSV row order.
         *
         *     Raises:
         *         HTTPException: If the upload is not CSV, exceeds the upload limit, has
         *             an invalid schema or row, or cannot be persisted in the draft
         *             region.
         *
         *     Side Effects:
         *         Reads the uploaded file, allocates public asset identifiers, and
         *         atomically persists every row through the owning store.
         */
        post: operations["create_region_asset_csv_api_v1_regions__region_id__assets_csv_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/assets.geojson": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get map-ready region assets
         * @description Return a deterministic bounded GeoJSON feature collection.
         *
         *     Args:
         *         region_id: Stable public identifier for the owning region.
         *         request: Active request containing optional cache validators.
         *         store: Concrete owning asset persistence boundary.
         *
         *     Returns:
         *         Canonical WGS84 GeoJSON containing public properties only.
         *
         *     Raises:
         *         HTTPException: If the region does not exist, persisted asset state is
         *             corrupt, or the encoded response exceeds the public size limit.
         */
        get: operations["get_region_assets_geojson_api_v1_regions__region_id__assets_geojson_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/assets/{asset_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get one regional asset
         * @description Return one tree or enriched conductor by canonical asset identity.
         *
         *     Args:
         *         region_id: Stable identifier for the owning region.
         *         asset_id: Stable public identifier for the requested asset.
         *         reader: Unified catalog and operational asset projection boundary.
         *
         *     Returns:
         *         The authoritative tree or power-line detail. Catalog-only power lines
         *         have no operational conductor or latest-physics values.
         *
         *     Raises:
         *         HTTPException: If the asset does not exist or persisted state is
         *             corrupt.
         */
        get: operations["get_asset_api_v1_regions__region_id__assets__asset_id__get"];
        put?: never;
        post?: never;
        /**
         * Delete a draft asset
         * @description Delete an asset from its owning draft region.
         *
         *     Args:
         *         region_id: Stable identifier for the asset's owning draft region.
         *         asset_id: Stable public identifier for the asset.
         *         store: Concrete owning asset persistence boundary.
         *
         *     Returns:
         *         Empty ``204 No Content`` response.
         *
         *     Raises:
         *         HTTPException: If the asset is missing, its region is immutable, or
         *             persisted state is corrupt.
         *
         *     Side Effects:
         *         Deletes the canonical asset and its regional index entry on success.
         */
        delete: operations["delete_asset_api_v1_regions__region_id__assets__asset_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update a draft asset
         * @description Update editable fields on an asset belonging to a draft.
         *
         *     Args:
         *         region_id: Stable identifier for the asset's owning draft region.
         *         asset_id: Stable public identifier for the asset.
         *         patch: Sparse validated editable fields.
         *         store: Draft-aware owning asset catalog.
         *
         *     Returns:
         *         The authoritative updated asset.
         *
         *     Raises:
         *         HTTPException: If the asset is missing, its region is immutable, the
         *             requested fields are invalid, or persisted state is corrupt.
         *
         *     Side Effects:
         *         Persists the validated editable fields through the owning store.
         */
        patch: operations["update_asset_api_v1_regions__region_id__assets__asset_id__patch"];
        trace?: never;
    };
    "/api/v1/regions/{region_id}/earth-engine": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get region Earth Engine metadata
         * @description Return safe configured static-data metadata and readiness.
         *
         *     Args:
         *         region_id: Stable public identifier for the requested region.
         *         catalog: Runtime-owned configured-source reader.
         *
         *     Returns:
         *         Selected public layer names, CRS, and startup readiness.
         */
        get: operations["get_region_earth_engine_metadata_api_v1_regions__region_id__earth_engine_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/earth-engine/map-layers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Earth Engine map layers
         * @description Return safe layer descriptors for configured Earth Engine inputs.
         *
         *     Args:
         *         region_id: Stable public identifier for the requested region.
         *         catalog: Runtime-owned configured-source reader and public projector.
         *
         *     Returns:
         *         Curated descriptors for configured static datasets.
         */
        get: operations["get_region_earth_engine_map_layers_api_v1_regions__region_id__earth_engine_map_layers_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/point-cloud-datasets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List region point-cloud datasets
         * @description Return deterministic point-cloud descriptors for one public region.
         *
         *     Args:
         *         region_id: Stable public identity of the owning region.
         *         catalog: Runtime-owned safe point-cloud read catalog.
         *
         *     Returns:
         *         All public descriptors and the optional active ready dataset identity.
         *
         *     Raises:
         *         HTTPException: If the region is not registered.
         *
         *     Side Effects:
         *         Emits a compact structured read event without source or storage data.
         */
        get: operations["list_region_point_cloud_datasets_api_v1_regions__region_id__point_cloud_datasets_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/point-cloud-datasets/{dataset_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a region point-cloud dataset
         * @description Return one point-cloud descriptor through its owning region.
         *
         *     Args:
         *         region_id: Stable public identity of the expected owner.
         *         dataset_id: Stable logical dataset identity returned by the collection.
         *         catalog: Runtime-owned safe point-cloud read catalog.
         *
         *     Returns:
         *         The requested lifecycle or ready rendering descriptor.
         *
         *     Raises:
         *         HTTPException: If the region or dataset is missing, or if the dataset
         *             belongs to another region.
         *
         *     Side Effects:
         *         Emits a compact structured read event without source or storage data.
         */
        get: operations["get_region_point_cloud_dataset_api_v1_regions__region_id__point_cloud_datasets__dataset_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/point-cloud-datasets/{dataset_id}/surveys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit a georeferenced point-cloud survey replacement
         * @description Accept one private survey and enqueue a complete immutable replacement.
         *
         *     Args:
         *         region_id: Configured region that owns the logical point-cloud dataset.
         *         dataset_id: Configured dataset whose selected ready version is replaced.
         *         request: Active request carrying a hosting-layer verified principal.
         *         file: Binary PLY upload. Large files remain spooled and are copied in
         *             bounded chunks outside the event loop.
         *         metadata: JSON-encoded reviewed georeferencing and ownership metadata.
         *         service: Runtime-owned point-cloud submission and command service.
         *
         *     Returns:
         *         Public-safe queued build identity and exact parent version.
         *
         *     Raises:
         *         HTTPException: If metadata is invalid, the file is not PLY or is too
         *             large, the configured dataset is missing, or no ready parent can be
         *             safely extended.
         *
         *     Side Effects:
         *         Streams the upload into private content-addressed storage, registers a
         *         composite source, persists queued build state, publishes one durable
         *         point-cloud command, and logs only safe identifiers and metrics.
         */
        post: operations["submit_region_point_cloud_survey_api_v1_regions__region_id__point_cloud_datasets__dataset_id__surveys_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Publish a region revision
         * @description Publish a draft as an immutable simulation-ready revision.
         *
         *     Args:
         *         region_id: Stable public identifier for the draft to publish.
         *         service: Coordinated region and tree-inventory publication boundary.
         *
         *     Returns:
         *         The published region with its immutable revision identifier.
         */
        post: operations["publish_region_api_v1_regions__region_id__publish_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/readiness": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get regional simulation prerequisites
         * @description Return safe regional prerequisites without implying runtime provisioning.
         *
         *     Args:
         *         region_id: Exact catalog identity, including unconfigured regions.
         *         catalog: Runtime-owned configured-source and grid readiness projection.
         *     Returns:
         *         Publication, configuration, source and hydrated-grid evidence.
         */
        get: operations["get_region_readiness_api_v1_regions__region_id__readiness_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/weather-datasets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List region weather datasets
         * @description Return one page of exact base-weather options for a region.
         *
         *     Args:
         *         region_id: Stable public identifier for the requested region.
         *         catalog: Runtime-owned dataset reader.
         *         cursor: Opaque position returned by the preceding page.
         *         limit: Maximum exact versions returned.
         *
         *     Returns:
         *         Newest-first exact immutable weather dataset summaries.
         *
         *     Raises:
         *         HTTPException: If the opaque cursor is invalid.
         */
        get: operations["list_region_weather_datasets_api_v1_regions__region_id__weather_datasets_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/weather-datasets/{dataset_id}/map-layers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List weather dataset map layers
         * @description Return safe layer descriptors for one exact weather dataset.
         *
         *     Args:
         *         region_id: Stable public identifier for the requested region.
         *         dataset_id: Exact identifier returned by the weather inventory.
         *         catalog: Runtime-owned dataset reader and public projector.
         *
         *     Returns:
         *         Curated descriptors for supported bands present in the snapshot.
         *
         *     Raises:
         *         HTTPException: If the dataset identifier is invalid or unavailable.
         */
        get: operations["get_weather_dataset_map_layers_api_v1_regions__region_id__weather_datasets__dataset_id__map_layers_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/weather-datasets/{dataset_id}/station-observations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List selected station observations for a weather dataset
         * @description Return source measurements, quality, and provenance for one snapshot.
         *
         *     Args:
         *         region_id: Stable public identifier for the requested region.
         *         dataset_id: Exact identifier returned by the weather inventory.
         *         catalog: Runtime-owned dataset reader and public projector.
         *
         *     Returns:
         *         Accepted source-station observations selected for the snapshot. Values
         *         that NWS did not report remain ``null`` rather than being inferred.
         *
         *     Raises:
         *         HTTPException: If the dataset identifier is invalid or unavailable.
         */
        get: operations["get_weather_dataset_station_observations_api_v1_regions__region_id__weather_datasets__dataset_id__station_observations_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/regions/{region_id}/weather-forecasts/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Resolve a regional forecast artifact
         * @description Return safe metadata for the immutable forecast selected by the Engine.
         *
         *     Args:
         *         region_id: Stable public operational region.
         *         catalog: Runtime-owned observed and forecast source catalog.
         *         issue_at_or_before: Inclusive NDFD issue cutoff.
         *         valid_at: Exact future tick time to resolve.
         *
         *     Returns:
         *         Forecast metadata without the private S3 artifact URI.
         *
         *     Raises:
         *         HTTPException: If no configured artifact satisfies the issue, validity,
         *             and regional coverage constraints.
         */
        get: operations["resolve_region_weather_forecast_api_v1_regions__region_id__weather_forecasts_resolve_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/scenarios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List immutable scenarios
         * @description Read a creation-indexed page in immutable scenario-ID order.
         *
         *     Args:
         *         store: Owning bounded listing boundary.
         *         request: Hosting access context for scoped collection filtering.
         *         region_id: Optional exact owner filter.
         *         cursor: Opaque position bound to the same region filter.
         *         limit: Maximum page size from one through one hundred.
         *     Returns:
         *         Authoritative immutable records with the next cursor.
         *     Raises:
         *         HTTPException: If the cursor is invalid.
         */
        get: operations["list_scenarios_api_v1_scenarios_get"];
        put?: never;
        /**
         * Create a synthetic-wind scenario
         * @description Validate, canonicalize, and persist one immutable wind scenario.
         *
         *     Args:
         *         candidate: Client inputs validated at the HTTP boundary.
         *         request: Hosting context used to scope protected idempotency keys.
         *         response: Mutable response used to publish the resource location.
         *         region_store: Published-region catalog used for spatial validation.
         *         store: Runtime-owned scenario persistence boundary.
         *         weather_store: Exact regional weather metadata persistence boundary.
         *         idempotency_key: Client identity for one logical scenario creation.
         *
         *     Returns:
         *         The authoritative persisted scenario.
         *
         *     Raises:
         *         HTTPException: If the region is unpublished, scenario bounds leave the
         *             region, the exact base-weather version is unavailable, or the
         *             idempotency key identifies different intent.
         *
         *     Side Effects:
         *         Persists scenario intent but creates no weather artifacts.
         */
        post: operations["create_scenario_api_v1_scenarios_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/scenarios/{scenario_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get an immutable scenario
         * @description Read the persisted immutable definition identified by the public ID.
         *
         *     Args:
         *         scenario_id: Stable scenario identity.
         *         store: Owning scenario persistence boundary.
         *     Returns:
         *         The authoritative definition without invented owner or date fields.
         *     Raises:
         *         HTTPException: If the definition does not exist.
         */
        get: operations["get_scenario_api_v1_scenarios__scenario_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/simulation-runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List simulation runs
         * @description Return one cursor-addressed page of durable simulation runs.
         *
         *     Args:
         *         store: Concrete owning persistence boundary for simulation runs.
         *         request: Hosting context used to scope run collection members.
         *         cursor: Opaque position returned by the preceding page.
         *         limit: Maximum number of runs to return.
         *
         *     Returns:
         *         A validated page of authoritative simulation-run contracts.
         */
        get: operations["list_simulation_runs_api_v1_simulation_runs_get"];
        put?: never;
        /**
         * Submit a simulation run
         * @description Persist and enqueue one validated manual wildfire simulation.
         *
         *     Args:
         *         candidate: Client-owned simulation inputs validated at the HTTP edge.
         *         request: Active request carrying its middleware-assigned request ID.
         *         response: Mutable response used to publish the resource location.
         *         commands: Service coordinating durable acceptance and publication.
         *         idempotency_key: Client key identifying one logical submission.
         *
         *     Returns:
         *         The newly queued run or the original run for an identical replay.
         *
         *     Raises:
         *         HTTPException: If the idempotency key belongs to another request.
         *
         *     Side Effects:
         *         Persists a queued run and publishes it once to Redis Streams.
         */
        post: operations["create_simulation_run_api_v1_simulation_runs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/simulation-runs/{run_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get simulation run status
         * @description Retrieve the durable run snapshot used for client recovery.
         *
         *     Args:
         *         run_id: Stable public identifier allocated when the run was accepted.
         *         store: Concrete owning persistence boundary for simulation runs.
         *
         *     Returns:
         *         The current authoritative run state.
         *
         *     Raises:
         *         HTTPException: If no run exists for the public identifier.
         */
        get: operations["get_simulation_run_api_v1_simulation_runs__run_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/simulation-runs/{run_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Request simulation cancellation
         * @description Durably cancel queued work or request an active tick-boundary stop.
         *
         *     Args:
         *         run_id: Stable public identifier for the simulation run.
         *         store: Authoritative lifecycle ledger.
         *
         *     Returns:
         *         The immediate ``CANCELLED`` queued run or active
         *         ``CANCEL_REQUESTED`` run. Repeated requests return the same state.
         *
         *     Raises:
         *         HTTPException: If the run is missing or already completed/failed.
         *
         *     Side Effects:
         *         Atomically updates durable run state. Active workers observe the
         *         request between Engine ticks and record terminal acknowledgement.
         */
        post: operations["cancel_simulation_run_api_v1_simulation_runs__run_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/simulation-runs/{run_id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Stream simulation run progress
         * @description Stream replayable progress until one simulation run becomes terminal.
         *
         *     Args:
         *         run_id: Stable public execution identifier selected by the browser.
         *         context: Prevalidated lifecycle record, progress store, and optional
         *             browser reconnection cursor.
         *
         *     Returns:
         *         Async iterator containing a current snapshot or replayed events
         *         followed by live progress. FastAPI wraps it in the declared native SSE
         *         response, and the iterator exits after a terminal event.
         *
         *     Raises:
         *         HTTPException: If the run does not exist or the supplied cursor is
         *             malformed.
         *
         *     Side Effects:
         *         Reads durable run/progress state, performs bounded blocking Redis reads,
         *         and holds one HTTP connection until terminal state or disconnection.
         */
        get: operations["stream_simulation_run_events_api_v1_simulation_runs__run_id__events_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/simulation-runs/{run_id}/result.geojson": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a simulation result
         * @description Return a completed run's deterministic bounded GeoJSON projection.
         *
         *     Args:
         *         run_id: Stable public identifier for the completed simulation run.
         *         request: Active request carrying an optional cache validator.
         *         projector: Read-only bounded result projection service.
         *
         *     Returns:
         *         Canonical GeoJSON, or ``304 Not Modified`` for a matching strong ETag.
         *
         *     Side Effects:
         *         Reads exact run, region, and final snapshot state in a worker thread.
         */
        get: operations["get_simulation_result_geojson_api_v1_simulation_runs__run_id__result_geojson_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/simulation-runs/{run_id}/ticks/{tick}/result.geojson": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a completed simulation tick artifact
         * @description Return one completed tick's deterministic bounded GeoJSON projection.
         *
         *     Args:
         *         run_id: Stable public identifier for the simulation run.
         *         tick: Positive compute tick previously announced through SSE.
         *         request: Active request carrying an optional cache validator.
         *         projector: Read-only bounded result projection service.
         *
         *     Returns:
         *         Canonical GeoJSON, or ``304 Not Modified`` for a matching strong ETag.
         *
         *     Side Effects:
         *         Reads exact run, region, and tick snapshot state in a worker thread.
         */
        get: operations["get_simulation_tick_result_geojson_api_v1_simulation_runs__run_id__ticks__tick__result_geojson_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * AcceptedScenarioSimulationRun
         * @description Return polling links for one accepted scenario-backed run.
         */
        AcceptedScenarioSimulationRun: {
            /** Result Url */
            result_url: string;
            /** Run Id */
            run_id: string;
            /** Scenario Id */
            scenario_id: string;
            /**
             * Status
             * @default queued
             * @constant
             */
            status: "queued";
            /** Status Url */
            status_url: string;
        };
        /**
         * AssetPatch
         * @description Sparse editable fields for either public asset kind.
         */
        AssetPatch: {
            /** Canopy Radius M */
            canopy_radius_m?: number | null;
            /** Coordinates */
            coordinates?: [
                components["schemas"]["PowerLineCoordinate"],
                components["schemas"]["PowerLineCoordinate"]
            ] | null;
            /** Height M */
            height_m?: number | null;
            location?: components["schemas"]["Coordinate"] | null;
            /** Name */
            name?: string | null;
            /** Species */
            species?: string | null;
        };
        /** Body_create_region_asset_csv_api_v1_regions__region_id__assets_csv_post */
        Body_create_region_asset_csv_api_v1_regions__region_id__assets_csv_post: {
            /**
             * File
             * @description UTF-8 CSV with exactly the columns type, properties, and coords. properties and coords are JSON values.
             */
            file: string;
        };
        /** Body_submit_region_point_cloud_survey_api_v1_regions__region_id__point_cloud_datasets__dataset_id__surveys_post */
        Body_submit_region_point_cloud_survey_api_v1_regions__region_id__point_cloud_datasets__dataset_id__surveys_post: {
            /**
             * File
             * @description Immutable local-coordinate PLY survey bytes.
             */
            file: string;
            /**
             * Metadata
             * @description JSON object containing reviewed placement, footprint, vertical reference, registration method, and RMSE.
             */
            metadata: string;
        };
        /**
         * BoundedSimulationTime
         * @description Select an exact inclusive UTC interval for a simulation run.
         *
         *     Attributes:
         *         mode: Stable discriminator for request-owned time bounds.
         *         start_at: First exact weather timestamp used by the run.
         *         end_at: Final exact weather timestamp used by the run.
         */
        BoundedSimulationTime: {
            /**
             * End At
             * Format: date-time
             */
            end_at: string;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            mode: "bounded";
            /**
             * Start At
             * Format: date-time
             */
            start_at: string;
        };
        /**
         * BoundingBox
         * @description Axis-aligned WGS84 bounding box for region and tile queries.
         *
         *     Attributes:
         *         west: Western longitude in decimal degrees.
         *         south: Southern latitude in decimal degrees.
         *         east: Eastern longitude in decimal degrees.
         *         north: Northern latitude in decimal degrees.
         */
        BoundingBox: {
            /** East */
            east: number;
            /** North */
            north: number;
            /** South */
            south: number;
            /** West */
            west: number;
        };
        /**
         * ConfiguredDataSource
         * @description Summarize one enabled regional source without private configuration.
         */
        ConfiguredDataSource: {
            /**
             * Kind
             * @enum {string}
             */
            kind: "weather" | "weather_forecast" | "earth_engine";
            /** Provider */
            provider: string;
            /** Ready */
            ready: boolean;
            /** Region Id */
            region_id: string;
            /** Source Id */
            source_id: string;
        };
        /**
         * Coordinate
         * @description WGS84 coordinate used by line geometry and segment endpoints.
         *
         *     Attributes:
         *         lat: Latitude in decimal degrees.
         *         lon: Longitude in decimal degrees.
         */
        Coordinate: {
            /** Lat */
            lat: number;
            /** Lon */
            lon: number;
        };
        /**
         * EarthEngineMetadata
         * @description Expose selected static layers and startup readiness without cache refs.
         */
        EarthEngineMetadata: {
            /** Crs */
            crs: string;
            /** Datasets */
            datasets: string[];
            /**
             * Provider
             * @constant
             */
            provider: "google_earth_engine";
            /** Ready */
            ready: boolean;
            /** Region Id */
            region_id: string;
            /** Source Id */
            source_id: string;
        };
        /**
         * FieldError
         * @description Describe one invalid public request field without echoing its input.
         *
         *     Attributes:
         *         field: Dot-separated request location such as ``body.name``.
         *         code: Stable validation category supplied by the validation boundary.
         *         message: Safe human-readable explanation of the field failure.
         */
        FieldError: {
            /** Code */
            code: string;
            /** Field */
            field: string;
            /** Message */
            message: string;
        };
        /**
         * ForecastDataset
         * @description Describe one immutable forecast catalog artifact without private URI.
         */
        ForecastDataset: {
            bounds: components["schemas"]["BoundingBox"];
            /** Crs */
            crs: string;
            /** Dataset Id */
            dataset_id: string;
            /** Fields */
            fields: string[];
            /**
             * Issue Time
             * Format: date-time
             */
            issue_time: string;
            /** Normalization Version */
            normalization_version: string;
            /** Ready */
            ready: boolean;
            /** Region Id */
            region_id: string;
            /** Resolution M */
            resolution_m: number;
            /** Source Fingerprint */
            source_fingerprint: string;
            /**
             * Valid Time
             * Format: date-time
             */
            valid_time: string;
        };
        /**
         * GeoJsonPoint
         * @description Represent one public WGS84 GeoJSON ignition point.
         */
        GeoJsonPoint: {
            /** Coordinates */
            coordinates: [
                number,
                number
            ];
            /**
             * Type
             * @constant
             */
            type: "Point";
        };
        /**
         * HealthStatus
         * @description Describe the process or hosted-runtime state reported by a health probe.
         *
         *     Attributes:
         *         status: ``live`` for process liveness or ``ready`` after successful
         *             Engine startup.
         */
        HealthStatus: {
            /**
             * Status
             * @enum {string}
             */
            status: "live" | "ready";
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /**
         * IgnitionPoint
         * @description Represent one WGS84 wildfire ignition location.
         *
         *     Attributes:
         *         lat: Latitude in decimal degrees.
         *         lon: Longitude in decimal degrees.
         */
        IgnitionPoint: {
            /** Lat */
            lat: number;
            /** Lon */
            lon: number;
        };
        /**
         * LandCoverBreakdownEntry
         * @description Measure final burned-or-burning area for one LANDFIRE EVT class.
         *
         *     Attributes:
         *         class_id: Integer value stored in the retained EVT raster.
         *         label: Human-readable label from the versioned EVT catalog.
         *         area_hectares: Final affected area assigned to this class in hectares.
         *         percentage: Share of all final burned-or-burning cells in this class.
         */
        LandCoverBreakdownEntry: {
            /** Area Hectares */
            area_hectares: number;
            /** Class Id */
            class_id: number;
            /** Label */
            label: string;
            /** Percentage */
            percentage: number;
        };
        /**
         * ManualWildfireRunTrigger
         * @description Record the validated inputs that requested a manual wildfire run.
         *
         *     Attributes:
         *         kind: Stable discriminator identifying a user-submitted manual run.
         *         correlation_id: Request identifier connecting HTTP acceptance to the
         *             queued workflow and its logs.
         *         time: User-selected present/forecast duration or exact UTC bounds.
         *         ignition_location: WGS84 ignition point supplied by the client.
         *         delta_t_hours: Duration represented by each simulation tick.
         */
        ManualWildfireRunTrigger: {
            /** Correlation Id */
            correlation_id: string;
            /** Delta T Hours */
            delta_t_hours: number;
            ignition_location: components["schemas"]["IgnitionPoint"];
            /**
             * Kind
             * @default manual
             * @constant
             */
            kind: "manual";
            /** Time */
            time: components["schemas"]["PresentForecastSimulationTime"] | components["schemas"]["BoundedSimulationTime"];
        };
        /**
         * MapLayerCollection
         * @description Return the bounded map-layer descriptors for one source.
         *
         *     Attributes:
         *         items: Curated, deterministic descriptors safe for browser clients.
         */
        MapLayerCollection: {
            /** Items */
            items: components["schemas"]["MapLayerDescriptor"][];
        };
        /**
         * MapLayerDefaultStyle
         * @description Describe the initial raster presentation suggested to map clients.
         *
         *     Attributes:
         *         colormap: Public renderer palette name.
         *         rescale_min: Source value mapped to the low end of the palette.
         *         rescale_max: Source value mapped to the high end of the palette.
         *         opacity: Initial layer opacity from zero through one.
         */
        MapLayerDefaultStyle: {
            /** Colormap */
            colormap: string;
            /** Opacity */
            opacity: number;
            /** Rescale Max */
            rescale_max: number;
            /** Rescale Min */
            rescale_min: number;
        };
        /**
         * MapLayerDescriptor
         * @description Describe one safe browser-facing raster layer without source references.
         *
         *     Attributes:
         *         layer_id: Stable public identifier accepted by the future artifact API.
         *         name: Human-readable layer label.
         *         category: Input family used to group layers in clients.
         *         format: Browser rendering format planned for this layer.
         *         url: Stable relative URL for the future COG bytes.
         *         bounds: WGS84 west-south-east-north extent.
         *         bounds_crs: Explicit coordinate system for ``bounds``.
         *         crs: Coordinate system retained by the planned raster artifact.
         *         band: Source band or configured dataset key.
         *         units: Public measurement unit or categorical-code marker.
         *         attribution: Safe source attribution shown by map clients.
         *         default_style: Initial renderer presentation.
         *         version: Exact source version, or ``None`` when the current static
         *             source catalog has no immutable version identifier.
         *         source_ready: Whether the Engine validated the source input.
         *         artifact_ready: Whether the URL currently resolves to a prepared COG.
         */
        MapLayerDescriptor: {
            /** Artifact Ready */
            artifact_ready: boolean;
            /** Attribution */
            attribution: string;
            /** Band */
            band: string;
            /** Bounds */
            bounds: [
                number,
                number,
                number,
                number
            ];
            /**
             * Bounds Crs
             * @constant
             */
            bounds_crs: "EPSG:4326";
            /**
             * Category
             * @enum {string}
             */
            category: "weather" | "earth_engine";
            /** Crs */
            crs: string;
            default_style: components["schemas"]["MapLayerDefaultStyle"];
            /**
             * Format
             * @constant
             */
            format: "cog";
            /** Layer Id */
            layer_id: string;
            /** Name */
            name: string;
            /** Source Ready */
            source_ready: boolean;
            /** Units */
            units: string;
            /** Url */
            url: string;
            /** Version */
            version: string | null;
        };
        /**
         * MapLayerReading
         * @description Return one browser-safe scalar sampled from a public raster layer.
         *
         *     Attributes:
         *         layer_id: Registered public map-layer identity used for the query.
         *         band: Weather or static-data band represented by the layer.
         *         longitude: Requested WGS84 longitude in decimal degrees.
         *         latitude: Requested WGS84 latitude in decimal degrees.
         *         value: Finite layer value, or ``None`` for an out-of-bounds or nodata
         *             location. Clients obtain display units from the layer descriptor.
         */
        MapLayerReading: {
            /** Band */
            band: string;
            /** Latitude */
            latitude: number;
            /** Layer Id */
            layer_id: string;
            /** Longitude */
            longitude: number;
            /** Value */
            value?: number | null;
        };
        /** Page[Region] */
        Page_Region_: {
            /** Items */
            items: components["schemas"]["Region"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** Page[SyntheticWindScenario] */
        Page_SyntheticWindScenario_: {
            /** Items */
            items: components["schemas"]["SyntheticWindScenario"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** Page[WeatherDataset] */
        Page_WeatherDataset_: {
            /** Items */
            items: components["schemas"]["WeatherDataset"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** Page[WildfireSimulationRun] */
        Page_WildfireSimulationRun_: {
            /** Items */
            items: components["schemas"]["WildfireSimulationRun"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /**
         * PointCloudDatasetCollection
         * @description Return deterministic point-cloud descriptors and the active selection.
         *
         *     Attributes:
         *         items: Dataset descriptors belonging to one region, ordered by stable
         *             logical dataset identity.
         *         active_dataset_id: Identifier of the one ready dataset clients should
         *             render, or ``None`` when the region has no active point cloud.
         */
        PointCloudDatasetCollection: {
            /** Active Dataset Id */
            active_dataset_id: string | null;
            /** Items */
            items: components["schemas"]["PointCloudDatasetDescriptor"][];
        };
        /**
         * PointCloudDatasetDescriptor
         * @description Describe one safe region-owned point-cloud dataset version.
         *
         *     The descriptor gives a client everything needed to choose and render one
         *     immutable 3D Tiles hierarchy while keeping source locations, storage keys,
         *     conversion policy, and credentials private.
         *
         *     Attributes:
         *         dataset_id: Stable logical dataset identity within its region.
         *         region_id: Stable identity of the region that owns the dataset.
         *         name: Human-readable label for user interfaces.
         *         status: Current build or publication lifecycle state.
         *         format: Explicit renderer dispatch value for point-cloud 3D Tiles.
         *         position_crs: Cartesian Earth-centered reference used by tile positions.
         *         scene_scale: Fixed one-metre-per-unit contract already applied to tile
         *             positions and geometric errors before publication.
         *         tileset_url: Root-relative Engine URL or absolute public HTTP(S) URL to
         *             ``tileset.json``; present only for ready datasets.
         *         bounds: WGS84 west-south-east-north extent.
         *         bounds_crs: Fixed coordinate system interpreting ``bounds``.
         *         point_count: Positive published hierarchy point count when ready.
         *         source_point_count: Positive pre-hierarchy source count when ready.
         *         minimum_spacing_m: Dense-leaf sampling floor in metres when ready.
         *         attributes: Unique public point attributes including ``position``.
         *         version: Immutable build/content identity selected before publication.
         *         attribution: Safe source attribution for display by clients.
         *         updated_at: UTC lifecycle timestamp.
         *         failure_code: Safe lower-snake-case failure category for failed builds.
         * @example {
         *       "attributes": [
         *         "position",
         *         "rgb"
         *       ],
         *       "attribution": "USGS 3DEP",
         *       "bounds": [
         *         -105.25,
         *         39.7,
         *         -105.15,
         *         39.8
         *       ],
         *       "bounds_crs": "EPSG:4326",
         *       "dataset_id": "golden-lidar-build",
         *       "format": "3d-tiles-point-cloud",
         *       "latest_build": {
         *         "status": "queued",
         *         "updated_at": "2026-08-11T15:00:00Z",
         *         "version": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
         *       },
         *       "name": "Golden LiDAR build",
         *       "position_crs": "EPSG:4978",
         *       "region_id": "colorado",
         *       "scene_scale": {
         *         "linear_unit": "meter",
         *         "meters_per_unit": 1
         *       },
         *       "status": "queued",
         *       "updated_at": "2026-08-11T15:00:00Z",
         *       "version": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
         *     }
         * @example {
         *       "attributes": [
         *         "position",
         *         "rgb"
         *       ],
         *       "attribution": "USGS 3DEP",
         *       "bounds": [
         *         -105.25,
         *         39.7,
         *         -105.15,
         *         39.8
         *       ],
         *       "bounds_crs": "EPSG:4326",
         *       "dataset_id": "golden-lidar",
         *       "format": "3d-tiles-point-cloud",
         *       "latest_build": {
         *         "status": "ready",
         *         "updated_at": "2026-08-11T15:30:00Z",
         *         "version": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
         *       },
         *       "minimum_spacing_m": 0.5,
         *       "name": "Golden, Colorado LiDAR",
         *       "point_count": 159000000,
         *       "position_crs": "EPSG:4978",
         *       "region_id": "colorado",
         *       "scene_scale": {
         *         "linear_unit": "meter",
         *         "meters_per_unit": 1
         *       },
         *       "source_point_count": 167600000,
         *       "status": "ready",
         *       "tileset_url": "/point-clouds/colorado/golden-lidar/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/tileset.json",
         *       "updated_at": "2026-08-11T15:30:00Z",
         *       "version": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
         *     }
         * @example {
         *       "attributes": [
         *         "position",
         *         "rgb"
         *       ],
         *       "attribution": "USGS 3DEP",
         *       "bounds": [
         *         -105.25,
         *         39.7,
         *         -105.15,
         *         39.8
         *       ],
         *       "bounds_crs": "EPSG:4326",
         *       "dataset_id": "golden-lidar-failed",
         *       "failure_code": "invalid_crs",
         *       "format": "3d-tiles-point-cloud",
         *       "latest_build": {
         *         "failure_code": "invalid_crs",
         *         "status": "failed",
         *         "updated_at": "2026-08-11T16:00:00Z",
         *         "version": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
         *       },
         *       "name": "Golden LiDAR replacement",
         *       "position_crs": "EPSG:4978",
         *       "region_id": "colorado",
         *       "scene_scale": {
         *         "linear_unit": "meter",
         *         "meters_per_unit": 1
         *       },
         *       "status": "failed",
         *       "updated_at": "2026-08-11T16:00:00Z",
         *       "version": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
         *     }
         */
        PointCloudDatasetDescriptor: {
            /** Attributes */
            attributes: string[];
            /** Attribution */
            attribution: string;
            /** Bounds */
            bounds: [
                number,
                number,
                number,
                number
            ];
            /**
             * Bounds Crs
             * @constant
             */
            bounds_crs: "EPSG:4326";
            /** Dataset Id */
            dataset_id: string;
            /** Failure Code */
            failure_code?: string | null;
            /**
             * Format
             * @constant
             */
            format: "3d-tiles-point-cloud";
            latest_build: components["schemas"]["PointCloudLatestBuild"];
            /** Minimum Spacing M */
            minimum_spacing_m: number | null;
            /** Name */
            name: string;
            /** Point Count */
            point_count: number | null;
            /**
             * Position Crs
             * @constant
             */
            position_crs: "EPSG:4978";
            /** Region Id */
            region_id: string;
            scene_scale: components["schemas"]["SceneScale"];
            /** Source Point Count */
            source_point_count: number | null;
            /**
             * Status
             * @enum {string}
             */
            status: "queued" | "building" | "ready" | "failed";
            /** Tileset Url */
            tileset_url: string | null;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Version */
            version: string;
        };
        /**
         * PointCloudLatestBuild
         * @description Expose the latest accepted build while previous ready tiles stay usable.
         *
         *     Compare version with the survey acceptance response before deciding that
         *     a replacement completed. Failure codes contain no private exception text.
         */
        PointCloudLatestBuild: {
            /** Failure Code */
            failure_code: string | null;
            /**
             * Status
             * @enum {string}
             */
            status: "queued" | "building" | "ready" | "failed";
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Version */
            version: string;
        };
        /**
         * PointCloudSurveySubmission
         * @description Confirm durable acceptance of one background survey replacement build.
         *
         *     Attributes:
         *         region_id: Region that owns the updated logical dataset.
         *         dataset_id: Dataset whose active lineage will move after verification.
         *         patch_id: Accepted survey identity supplied by the caller.
         *         status: Initial durable build state.
         *         version: Immutable content and build lineage selected at submission.
         *         parent_version: Ready version the survey replacement extends.
         */
        PointCloudSurveySubmission: {
            /** Dataset Id */
            dataset_id: string;
            /** Parent Version */
            parent_version: string;
            /** Patch Id */
            patch_id: string;
            /** Region Id */
            region_id: string;
            /**
             * Status
             * @default queued
             * @constant
             */
            status: "queued";
            /** Version */
            version: string;
        };
        /**
         * PointCloudSurveyUploadMetadata
         * @description Describe the reviewed world placement of one uploaded local PLY survey.
         *
         *     Attributes:
         *         patch_id: Stable lower-kebab-case identity for this accepted survey.
         *         acquired_at: UTC timestamp when the survey was captured.
         *         target_crs: Projected horizontal CRS whose axes use metres.
         *         vertical_datum: Reviewed vertical reference identifier.
         *         meters_per_source_unit: Calibrated conversion from one local PLY unit
         *             to metres.
         *         local_to_target_matrix: Row-major affine 4-by-4 transform from local PLY
         *             coordinates into ``target_crs`` metre coordinates. Its linear
         *             component must match ``meters_per_source_unit`` uniformly.
         *         replacement_footprint_wkt: Trusted Polygon or MultiPolygon coverage in
         *             the target coordinate frame.
         *         replacement_z_range: Trusted minimum and maximum target elevations.
         *         registration_method: Reviewed global placement method.
         *         registration_rmse_m: Measured placement error in metres.
         */
        PointCloudSurveyUploadMetadata: {
            /**
             * Acquired At
             * Format: date-time
             */
            acquired_at: string;
            /** Local To Target Matrix */
            local_to_target_matrix: number[];
            /** Meters Per Source Unit */
            meters_per_source_unit: number;
            /** Patch Id */
            patch_id: string;
            /**
             * Registration Method
             * @enum {string}
             */
            registration_method: "rtk_trajectory" | "ground_control_points" | "point_pair_icp";
            /** Registration Rmse M */
            registration_rmse_m: number;
            /** Replacement Footprint Wkt */
            replacement_footprint_wkt: string;
            /** Replacement Z Range */
            replacement_z_range: [
                number,
                number
            ];
            /** Target Crs */
            target_crs: string;
            /** Vertical Datum */
            vertical_datum: string;
        };
        /**
         * PolygonGeometry
         * @description Represent the single rectangular GeoJSON polygon accepted by the API.
         */
        PolygonGeometry: {
            /** Coordinates */
            coordinates: [
                number,
                number
            ][][];
            /**
             * Type
             * @constant
             */
            type: "Polygon";
        };
        /**
         * PowerLineAssetCreate
         * @description Client-owned fields for one WGS84 power line.
         */
        PowerLineAssetCreate: {
            /** Coordinates */
            coordinates: [
                components["schemas"]["PowerLineCoordinate"],
                components["schemas"]["PowerLineCoordinate"]
            ];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "power_line";
            /** Name */
            name?: string | null;
        };
        /**
         * PowerLineCollisionEnvelope
         * @description Expose the solved conductor footprint in span-local meters.
         */
        PowerLineCollisionEnvelope: {
            /** Max X */
            max_x: number;
            /** Max Y */
            max_y: number;
            /** Min X */
            min_x: number;
            /** Min Y */
            min_y: number;
        };
        /**
         * PowerLineConductor
         * @description Expose authoritative static conductor inputs in explicit SI units.
         *
         *     The final three fields come from the exact versioned feature lookup used by
         *     the latest physics tick. They are absent before that lookup is available.
         */
        PowerLineConductor: {
            /** Air Density Kg M3 */
            air_density_kg_m3: number;
            /** Conductor Diameter M */
            conductor_diameter_m: number;
            /** Cross Sectional Area M2 */
            cross_sectional_area_m2?: number | null;
            /** Drag Coefficient */
            drag_coefficient: number;
            /** Elastic Modulus Pa */
            elastic_modulus_pa?: number | null;
            /** Horizontal Tension N */
            horizontal_tension_n: number;
            /** Mass Per Meter Kg M */
            mass_per_meter_kg_m: number;
            /** Span Length M */
            span_length_m: number;
            /** Static Sag M */
            static_sag_m?: number | null;
        };
        /**
         * PowerLineConductorOffset
         * @description Place one conductor relative to its support-to-support centerline.
         */
        PowerLineConductorOffset: {
            /** Lateral */
            lateral: number;
            /** Vertical */
            vertical: number;
        };
        /**
         * PowerLineCoordinate
         * @description One WGS84 conductor support coordinate with absolute elevation.
         *
         *     Attributes:
         *         elevation_m: Absolute elevation of the conductor support in meters.
         *             This is not terrain elevation or pole height; it is the vertical
         *             coordinate rendered and used for the power-line geometry.
         */
        PowerLineCoordinate: {
            /** Elevation M */
            elevation_m: number;
            /** Lat */
            lat: number;
            /** Lon */
            lon: number;
        };
        /**
         * PowerLineDetail
         * @description Return one tracked line's static inputs and latest complete physics.
         *
         *     Attributes:
         *         kind: Asset discriminator, always ``power_line``.
         *         asset_id: Canonical asset identifier for the conductor span.
         *         region_id: Region whose versioned inventory owns the line.
         *         name: Optional catalog label for the span.
         *         scene_scale: Fixed declaration that every physical distance already
         *             uses one metre per frontend world unit.
         *         geometry: WGS84 endpoints and bounding extent.
         *         conductor: Static physical and feature-lookup inputs in SI units, or
         *             ``None`` while a catalog span has not entered operational state.
         *         latest_physics: Latest fully committed result, or ``None`` before the
         *             region has completed a physics tick.
         */
        PowerLineDetail: {
            /** Asset Id */
            asset_id: string;
            conductor?: components["schemas"]["PowerLineConductor"] | null;
            /** Conductor Offsets M */
            conductor_offsets_m?: components["schemas"]["PowerLineConductorOffset"][];
            geometry: components["schemas"]["PowerLineGeometry"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "power_line";
            /** Latest Physics */
            latest_physics?: (components["schemas"]["PowerLinePhysicsSuccess"] | components["schemas"]["PowerLinePhysicsFailure"]) | null;
            /** Name */
            name?: string | null;
            /** Region Id */
            region_id: string;
            scene_scale: components["schemas"]["SceneScale"];
        };
        /**
         * PowerLineGeometry
         * @description Represent one WGS84 conductor span as a GeoJSON line.
         *
         *     Attributes:
         *         type: GeoJSON geometry discriminator, always ``LineString``.
         *         coordinates: Ordered ``(longitude, latitude, elevation_m)`` conductor
         *             support coordinates, where elevation is absolute meters.
         *         bounds: Axis-aligned WGS84 extent of the tracked conductor.
         */
        PowerLineGeometry: {
            bounds: components["schemas"]["BoundingBox"];
            /** Coordinates */
            coordinates: [
                [
                    number,
                    number,
                    number
                ],
                [
                    number,
                    number,
                    number
                ]
            ];
            /**
             * Type
             * @default LineString
             * @constant
             */
            type: "LineString";
        };
        /**
         * PowerLinePhysicsFailure
         * @description Expose a latest isolated solver failure without unsafe diagnostics.
         */
        PowerLinePhysicsFailure: {
            /** Cached From Tick */
            cached_from_tick?: number | null;
            /**
             * Failure Kind
             * @enum {string}
             */
            failure_kind: "non_convergent" | "solver_error";
            /** Feature Contract Version */
            feature_contract_version: string;
            /** Line Snapshot */
            line_snapshot: number;
            /** Model Checksum */
            model_checksum: string;
            /** Model Version */
            model_version: string;
            /** Routing Reason */
            routing_reason?: string | null;
            /** Solver Version */
            solver_version?: string | null;
            /**
             * Source
             * @default failed
             * @constant
             */
            source: "failed";
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "failed";
            /** Surrogate Confidence */
            surrogate_confidence?: number | null;
            /** Tick */
            tick: number;
            /** Weather Source Ref */
            weather_source_ref: string;
            /**
             * Weather Version
             * Format: date-time
             */
            weather_version: string;
        };
        /**
         * PowerLinePhysicsSuccess
         * @description Expose a usable latest displacement result and collision footprint.
         */
        PowerLinePhysicsSuccess: {
            /** Cached From Tick */
            cached_from_tick?: number | null;
            collision_envelope_m: components["schemas"]["PowerLineCollisionEnvelope"];
            /** Feature Contract Version */
            feature_contract_version: string;
            /** Line Snapshot */
            line_snapshot: number;
            /** Max Displacement M */
            max_displacement_m: number;
            /** Max Displacement Position M */
            max_displacement_position_m: number;
            /** Midspan Displacement M */
            midspan_displacement_m: number;
            /** Model Checksum */
            model_checksum: string;
            /** Model Version */
            model_version: string;
            /** Routing Reason */
            routing_reason?: string | null;
            /** Solver Version */
            solver_version?: string | null;
            /**
             * Source
             * @enum {string}
             */
            source: "surrogate" | "cached" | "fem";
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "succeeded";
            /** Surrogate Confidence */
            surrogate_confidence?: number | null;
            /** Tick */
            tick: number;
            /** Weather Source Ref */
            weather_source_ref: string;
            /**
             * Weather Version
             * Format: date-time
             */
            weather_version: string;
            /** Wind Speed Mps */
            wind_speed_mps: number;
        };
        /**
         * PresentForecastSimulationTime
         * @description Select the newest usable weather and a forward simulation duration.
         *
         *     Attributes:
         *         mode: Stable discriminator for present and forecast source selection.
         *         duration_hours: Positive simulated duration beginning at the
         *             server-resolved newest usable weather timestamp.
         */
        PresentForecastSimulationTime: {
            /** Duration Hours */
            duration_hours: number;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            mode: "present_forecast";
        };
        /**
         * ProblemDetails
         * @description Return one safe problem-details shape for every public API failure.
         *
         *     Attributes:
         *         type: Problem type URI. The foundation uses ``about:blank`` while the
         *             stable ``code`` extension distinguishes machine-readable failures.
         *         title: Short, safe summary of the failure category.
         *         status: HTTP response status repeated in the body for API clients.
         *         detail: Safe human-readable explanation that omits private internals.
         *         code: Stable lower-snake-case machine-readable failure code.
         *         request_id: Request identity shared with the response header and logs.
         *         retryable: Whether a bounded retry may succeed without changing input.
         *         field_errors: Invalid request fields, empty for non-validation failures.
         */
        ProblemDetails: {
            /** Code */
            code: string;
            /** Detail */
            detail: string;
            /** Field Errors */
            field_errors?: components["schemas"]["FieldError"][];
            /** Request Id */
            request_id: string;
            /** Retryable */
            retryable: boolean;
            /** Status */
            status: number;
            /** Title */
            title: string;
            /**
             * Type
             * @default about:blank
             */
            type: string;
        };
        /**
         * Region
         * @description Describe one geographic region managed by the catalog.
         *
         *     The complete contract crosses state, job, and response boundaries. Public
         *     create requests supply only editable content; the API allocates
         *     ``region_id`` before passing this complete contract to the catalog. The
         *     catalog remains authoritative for lifecycle transitions.
         *
         *     Attributes:
         *         region_id: Stable identifier used by state, jobs, and simulation runs.
         *         name: Human-readable region name shown to API clients.
         *         bounds: WGS84 extent used for spatial inventory and map queries.
         *         status: Current draft or published lifecycle state.
         *         published_revision_id: Immutable revision currently published for
         *             simulation use, or ``None`` while the region remains a draft.
         */
        Region: {
            bounds: components["schemas"]["BoundingBox"];
            /** Name */
            name: string;
            /** Published Revision Id */
            published_revision_id?: string | null;
            /** Region Id */
            region_id: string;
            /** @default draft */
            status: components["schemas"]["RegionStatus"];
        };
        /**
         * RegionCreate
         * @description Describe client-owned fields for a new region draft.
         *
         *     The API allocates persistence identity and the region store owns lifecycle
         *     fields, so clients provide only the editable region content.
         *
         *     Attributes:
         *         name: Human-readable name shown to API clients.
         *         bounds: WGS84 extent used for spatial inventory and map queries.
         */
        RegionCreate: {
            bounds: components["schemas"]["BoundingBox"];
            /** Name */
            name: string;
        };
        /**
         * RegionPatch
         * @description Describe editable region fields supplied by a partial update.
         *
         *     Attributes:
         *         name: Replacement human-readable name when supplied.
         *         bounds: Replacement WGS84 extent when supplied.
         */
        RegionPatch: {
            bounds?: components["schemas"]["BoundingBox"] | null;
            /** Name */
            name?: string | null;
        };
        /**
         * RegionReadiness
         * @description Expose publication and validated regional prerequisites without private refs.
         *
         *     ``ready_to_simulate`` is a prerequisite projection, not a worker-health or
         *     exact forecast reservation guarantee. Publication provisions no runtime.
         */
        RegionReadiness: {
            /** Configured */
            configured: boolean;
            /** Grid Hydrated */
            grid_hydrated: boolean;
            publication_status: components["schemas"]["RegionStatus"];
            /** Ready To Simulate */
            ready_to_simulate: boolean;
            /** Reason Codes */
            reason_codes: ("region_not_published" | "region_not_configured" | "grid_not_hydrated" | "runtime_unavailable" | "weather_not_ready" | "earth_engine_not_ready")[];
            /** Region Id */
            region_id: string;
            /** Runtime Ready */
            runtime_ready: boolean;
            /** Sources */
            sources: components["schemas"]["ConfiguredDataSource"][];
        };
        /**
         * RegionStatus
         * @description Public lifecycle states for an editable or published region.
         * @enum {string}
         */
        RegionStatus: "draft" | "published";
        /**
         * ScenarioCreate
         * @description Describe client-owned inputs for an immutable wind scenario.
         */
        ScenarioCreate: {
            /**
             * Base Weather Version
             * Format: date-time
             */
            base_weather_version: string;
            /** Duration Hours */
            duration_hours: number;
            geometry: components["schemas"]["PolygonGeometry"];
            /** Name */
            name: string;
            /** Region Id */
            region_id: string;
            wind_direction: components["schemas"]["WindDirectionInput"];
            wind_speed: components["schemas"]["WindSpeedInput"];
        };
        /**
         * ScenarioStatus
         * @description Public lifecycle states for a synthetic-input scenario.
         * @enum {string}
         */
        ScenarioStatus: "ready";
        /**
         * ScenarioWildfireRunTrigger
         * @description Freeze immutable scenario and ignition lineage for a user run.
         *
         *     Attributes:
         *         kind: Stable discriminator for scenario-backed execution.
         *         correlation_id: Request identity connecting acceptance and execution.
         *         scenario_id: Immutable scenario definition selected by the user.
         *         scenario_name: Human-readable scenario name frozen at submission time.
         *         base_weather_version: Exact weather snapshot pinned by that scenario.
         *         ignition_points: Ordered initial fire locations supplied by the user.
         *         duration_hours: Simulated horizon inherited from the scenario.
         *         delta_t_hours: Duration represented by each wildfire tick.
         */
        ScenarioWildfireRunTrigger: {
            /**
             * Base Weather Version
             * Format: date-time
             */
            base_weather_version: string;
            /** Correlation Id */
            correlation_id: string;
            /** Delta T Hours */
            delta_t_hours: number;
            /** Duration Hours */
            duration_hours: number;
            /** Ignition Points */
            ignition_points: components["schemas"]["IgnitionPoint"][];
            /**
             * Kind
             * @default scenario
             * @constant
             */
            kind: "scenario";
            /** Scenario Id */
            scenario_id: string;
            /** Scenario Name */
            scenario_name: string;
        };
        /**
         * ScenarioWindDirection
         * @description Preserve a public compass bearing and its Engine-ready direction.
         *
         *     Attributes:
         *         submitted_bearing_degrees: Clockwise bearing from true north.
         *         reference: Direction reference, explicitly describing travel toward.
         *         canonical_engine_degrees: Counterclockwise direction from east.
         */
        ScenarioWindDirection: {
            /** Canonical Engine Degrees */
            canonical_engine_degrees: number;
            /**
             * Reference
             * @constant
             */
            reference: "towards";
            /** Submitted Bearing Degrees */
            submitted_bearing_degrees: number;
        };
        /**
         * ScenarioWindSpeed
         * @description Preserve submitted wind speed alongside the Engine-ready value.
         *
         *     Attributes:
         *         submitted_value: Numeric speed supplied by the user.
         *         submitted_unit: Unit attached to the submitted speed.
         *         canonical_meters_per_second: Speed consumed by the wildfire Engine.
         */
        ScenarioWindSpeed: {
            /** Canonical Meters Per Second */
            canonical_meters_per_second: number;
            /**
             * Submitted Unit
             * @enum {string}
             */
            submitted_unit: "mph" | "m/s";
            /** Submitted Value */
            submitted_value: number;
        };
        /**
         * ScenePowerLineAsset
         * @description Serve one conductor span after its vertical positions use metric scale.
         *
         *     Attributes:
         *         scene_scale: Fixed declaration that elevation and physical line values
         *             already use one metre per frontend world unit.
         *         latest_physics: Result from the latest complete regional tick, including
         *             exact weather lineage, or None before the first calculation.
         */
        ScenePowerLineAsset: {
            /** Asset Id */
            asset_id: string;
            /** Conductor Offsets M */
            conductor_offsets_m?: components["schemas"]["PowerLineConductorOffset"][];
            /** Coordinates */
            coordinates: [
                components["schemas"]["PowerLineCoordinate"],
                components["schemas"]["PowerLineCoordinate"]
            ];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "power_line";
            /** Latest Physics */
            latest_physics?: (components["schemas"]["PowerLinePhysicsSuccess"] | components["schemas"]["PowerLinePhysicsFailure"]) | null;
            /** Measured Path */
            measured_path?: components["schemas"]["PowerLineCoordinate"][] | null;
            /** Name */
            name?: string | null;
            /** Region Id */
            region_id: string;
            scene_scale: components["schemas"]["SceneScale"];
            /** Source Ref */
            source_ref?: string | null;
            /** Support Ids */
            support_ids?: [
                string,
                string
            ] | null;
        };
        /**
         * ScenePowerPoleAsset
         * @description Serve measured support geometry at one metre per scene unit.
         */
        ScenePowerPoleAsset: {
            /** Asset Id */
            asset_id: string;
            base: components["schemas"]["PowerLineCoordinate"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "power_pole";
            /** Radius M */
            radius_m: number;
            /** Region Id */
            region_id: string;
            scene_scale: components["schemas"]["SceneScale"];
            /** Source Ref */
            source_ref: string;
            top: components["schemas"]["PowerLineCoordinate"];
        };
        /**
         * SceneScale
         * @description Declare the fixed linear scale of renderable Engine output.
         *
         *     The contract applies to Cartesian positions, offsets, heights, radii,
         *     widths, and other physical distances. Longitude and latitude remain
         *     angular WGS84 coordinates where a public geometry explicitly says so.
         *
         *     Attributes:
         *         linear_unit: Canonical unit used for physical scene measurements.
         *         meters_per_unit: Exact conversion from one scene unit to metres.
         */
        SceneScale: {
            /**
             * Linear Unit
             * @default meter
             * @constant
             */
            linear_unit: "meter";
            /**
             * Meters Per Unit
             * @default 1
             */
            meters_per_unit: number;
        };
        /**
         * SceneTreeAsset
         * @description Serve one tree after its physical dimensions use metric scene scale.
         *
         *     Attributes:
         *         scene_scale: Fixed declaration that height and canopy radius already use
         *             one metre per frontend world unit.
         */
        SceneTreeAsset: {
            /** Asset Id */
            asset_id: string;
            /** Canopy Radius M */
            canopy_radius_m?: number | null;
            /** Height M */
            height_m?: number | null;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "tree";
            location: components["schemas"]["Coordinate"];
            /** Region Id */
            region_id: string;
            scene_scale: components["schemas"]["SceneScale"];
            segmentation?: components["schemas"]["TreeSegmentation"] | null;
            /** Source Ref */
            source_ref?: string | null;
            /** Species */
            species?: string | null;
        };
        /**
         * SimulationRunFailure
         * @description Compact audit detail for a terminal failed simulation run.
         *
         *     Attributes:
         *         error_type: Stable exception or workflow error category.
         *         error_message: Human-readable failure reason retained with the run.
         */
        SimulationRunFailure: {
            /** Error Message */
            error_message: string;
            /** Error Type */
            error_type: string;
        };
        /**
         * SimulationRunMetrics
         * @description Record authoritative impact measurements for a completed wildfire run.
         *
         *     Attributes:
         *         final_burning_cells: Cells actively burning after the final tick.
         *         final_burned_cells: Cells in the model's burned-state channel after the
         *             final tick.
         *         burned_area_hectares: Final area that is burning or burned, calculated
         *             from the union cell count and authoritative square-cell resolution.
         *         peak_spread_rate_hectares_per_hour: Largest positive tick-to-tick
         *             increase in burning-or-burned area divided by simulated tick hours.
         *         land_cover_breakdown: Final burned-or-burning area grouped by the
         *             retained LANDFIRE EVT class raster.
         */
        SimulationRunMetrics: {
            /** Burned Area Hectares */
            burned_area_hectares: number;
            /** Final Burned Cells */
            final_burned_cells: number;
            /** Final Burning Cells */
            final_burning_cells: number;
            /** Land Cover Breakdown */
            land_cover_breakdown: components["schemas"]["LandCoverBreakdownEntry"][];
            /** Peak Spread Rate Hectares Per Hour */
            peak_spread_rate_hectares_per_hour: number;
        };
        /**
         * SimulationRunRequest
         * @description Validate either direct-time or scenario-backed submission intent.
         *
         *     One concrete shape must be complete. Keeping the alternatives inside one
         *     strict model preserves direct field locations for forbidden client-owned
         *     lineage such as ``weather_input_ref``.
         */
        SimulationRunRequest: {
            /** Delta T Hours */
            delta_t_hours?: number | null;
            ignition_location?: components["schemas"]["IgnitionPoint"] | null;
            /** Ignition Points */
            ignition_points?: components["schemas"]["GeoJsonPoint"][] | null;
            /** Region Id */
            region_id?: string | null;
            /** Scenario Id */
            scenario_id?: string | null;
            /** Time */
            time?: (components["schemas"]["PresentForecastSimulationTime"] | components["schemas"]["BoundedSimulationTime"]) | null;
        };
        /**
         * SimulationRunStatus
         * @description Durable lifecycle states for one wildfire simulation run.
         * @enum {string}
         */
        SimulationRunStatus: "QUEUED" | "STARTED" | "CANCEL_REQUESTED" | "CANCELLED" | "COMPLETED" | "FAILED";
        /**
         * SimulationTickRef
         * @description Reference one ordered wildfire snapshot produced by a run tick.
         *
         *     Attributes:
         *         tick: Nonnegative wildfire tick represented by the snapshot.
         *         world_state_ref: Exact ``state://world/pytorchfire/...`` reference to
         *             the persisted snapshot body.
         */
        SimulationTickRef: {
            /** Tick */
            tick: number;
            /** World State Ref */
            world_state_ref: string;
        };
        /**
         * SyntheticWindScenario
         * @description Describe one immutable, bounded wind override for a future simulation.
         *
         *     Attributes:
         *         scenario_id: Stable public identity allocated by the API.
         *         name: Human-readable scenario name supplied by the user.
         *         region_id: Published region containing the override bounds.
         *         bounds: Axis-aligned WGS84 extent selected by the user.
         *         base_weather_version: Exact weather version on which the override rests.
         *         wind_speed: Submitted and canonical wind-speed values.
         *         wind_direction: Submitted and canonical wind-direction values.
         *         duration_hours: Simulated interval for which the override applies.
         *         status: Current immutable scenario lifecycle state.
         */
        SyntheticWindScenario: {
            /**
             * Base Weather Version
             * Format: date-time
             */
            base_weather_version: string;
            bounds: components["schemas"]["BoundingBox"];
            /** Duration Hours */
            duration_hours: number;
            /** Name */
            name: string;
            /** Region Id */
            region_id: string;
            /** Scenario Id */
            scenario_id: string;
            /** @default ready */
            status: components["schemas"]["ScenarioStatus"];
            wind_direction: components["schemas"]["ScenarioWindDirection"];
            wind_speed: components["schemas"]["ScenarioWindSpeed"];
        };
        /**
         * TreeAssetCreate
         * @description Client-owned location, dimensions, and source lineage for one tree.
         */
        TreeAssetCreate: {
            /** Canopy Radius M */
            canopy_radius_m?: number | null;
            /** Height M */
            height_m?: number | null;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "tree";
            location: components["schemas"]["Coordinate"];
            /** Source Ref */
            source_ref?: string | null;
            /** Species */
            species?: string | null;
        };
        /**
         * TreeSegmentation
         * @description Measure accepted native tree points in absolute WGS84/elevation metres.
         */
        TreeSegmentation: {
            /** Bounds */
            bounds: [
                number,
                number,
                number,
                number,
                number,
                number
            ];
            /** Point Count */
            point_count: number;
        };
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
        /**
         * WeatherCoverage
         * @description Summarize the station evidence used to materialize an observation grid.
         *
         *     Attributes:
         *         station_count: Distinct accepted stations represented by the grid.
         *         oldest_observed_at: Oldest selected station observation in UTC.
         *         newest_observed_at: Newest selected station observation in UTC.
         *         max_grid_station_distance_m: Largest nearest-station distance assigned
         *             to any grid cell.
         */
        WeatherCoverage: {
            /** Max Grid Station Distance M */
            max_grid_station_distance_m: number;
            /**
             * Newest Observed At
             * Format: date-time
             */
            newest_observed_at: string;
            /**
             * Oldest Observed At
             * Format: date-time
             */
            oldest_observed_at: string;
            /** Station Count */
            station_count: number;
        };
        /**
         * WeatherDataset
         * @description Describe immutable weather and its configured live-monitoring expiry.
         *
         *     ``ready`` describes artifact availability, including historical datasets.
         *     ``fresh_until`` is the observation time plus the region's maximum weather
         *     age, so clients can distinguish usable history from current observations.
         */
        WeatherDataset: {
            /** Band Names */
            band_names: string[];
            bounds: components["schemas"]["BoundingBox"];
            coverage?: components["schemas"]["WeatherCoverage"] | null;
            /** Crs */
            crs: string;
            /** Dataset Id */
            dataset_id: string;
            /**
             * Fresh Until
             * Format: date-time
             */
            fresh_until: string;
            /** Grid Shape */
            grid_shape: [
                number,
                number
            ];
            /** Provider */
            provider: string;
            /** Ready */
            ready: boolean;
            /** Region Id */
            region_id: string;
            /** Resolution M */
            resolution_m: number;
            /**
             * Source Kind
             * @enum {string}
             */
            source_kind: "observation" | "analysis" | "forecast";
            /**
             * Version
             * Format: date-time
             */
            version: string;
        };
        /**
         * WeatherStationObservation
         * @description Expose one accepted source-station observation without diagnostic text.
         *
         *     The contract preserves accepted NWS measurements and their provenance as
         *     received from the canonical Aurora relation. ``raw_message`` is excluded
         *     because it is an unstable upstream diagnostic field rather than product
         *     data. Nullable measurements mean the station did not publish a valid value
         *     at this timestamp; they are not substituted or inferred here.
         *
         *     Attributes:
         *         dataset_id: Stable upstream dataset identity.
         *         station_id: Stable source station identity.
         *         observed_at: UTC time at which the station measured the observation.
         *         lat: WGS84 latitude in decimal degrees.
         *         lon: WGS84 longitude in decimal degrees.
         *         elevation_m: Station elevation in meters, when published.
         *         temperature_c: Air temperature in degrees Celsius.
         *         dew_point_c: Dew-point temperature in degrees Celsius.
         *         relative_humidity_pct: Relative humidity in percent.
         *         wind_speed_m_s: Wind speed in meters per second.
         *         wind_from_degrees: Meteorological wind-from direction in degrees.
         *         wind_gust_m_s: Wind-gust speed in meters per second.
         *         precipitation_last_hour_m: Accumulated precipitation over the prior
         *             hour in meters, not an instantaneous rain rate.
         *         barometric_pressure_pa: Station barometric pressure in pascals.
         *         sea_level_pressure_pa: Sea-level pressure in pascals.
         *         visibility_m: Horizontal visibility in meters.
         *         text_description: Unstructured public condition summary, when present.
         *         quality_status: Pipeline acceptance state for this source row.
         *         quality_control: Provider quality flags keyed by measurement name.
         *         source_provider: Upstream provider identifier.
         *         source_record_id: Immutable upstream record identity.
         *         ingested_at: UTC time at which the pipeline persisted the row.
         */
        WeatherStationObservation: {
            /** Barometric Pressure Pa */
            barometric_pressure_pa?: number | null;
            /** Dataset Id */
            dataset_id: string;
            /** Dew Point C */
            dew_point_c?: number | null;
            /** Elevation M */
            elevation_m?: number | null;
            /**
             * Ingested At
             * Format: date-time
             */
            ingested_at: string;
            /** Lat */
            lat: number;
            /** Lon */
            lon: number;
            /**
             * Observed At
             * Format: date-time
             */
            observed_at: string;
            /** Precipitation Last Hour M */
            precipitation_last_hour_m?: number | null;
            /** Quality Control */
            quality_control: {
                [key: string]: string;
            };
            /**
             * Quality Status
             * @enum {string}
             */
            quality_status: "accepted" | "incomplete";
            /** Relative Humidity Pct */
            relative_humidity_pct?: number | null;
            /** Sea Level Pressure Pa */
            sea_level_pressure_pa?: number | null;
            /** Source Provider */
            source_provider: string;
            /** Source Record Id */
            source_record_id: string;
            /** Station Id */
            station_id: string;
            /** Temperature C */
            temperature_c?: number | null;
            /** Text Description */
            text_description?: string | null;
            /** Visibility M */
            visibility_m?: number | null;
            /** Wind From Degrees */
            wind_from_degrees?: number | null;
            /** Wind Gust M S */
            wind_gust_m_s?: number | null;
            /** Wind Speed M S */
            wind_speed_m_s?: number | null;
        };
        /**
         * WeatherStationObservationCollection
         * @description Return all accepted station observations selected for one dataset.
         *
         *     Attributes:
         *         items: One latest eligible observation per selected station, including
         *             nullable measurements and source quality/provenance metadata. Raw
         *             upstream diagnostic messages are never included.
         */
        WeatherStationObservationCollection: {
            /** Items */
            items: components["schemas"]["WeatherStationObservation"][];
        };
        /**
         * WildfireGridGeometry
         * @description Persist the exact spatial transform shared by wildfire grid arrays.
         *
         *     Attributes:
         *         name: Stable diagnostic name for the hydrated grid.
         *         wgs84_bounds: Optional original request bounds retained as intent, never
         *             used as the raster transform.
         *         crs: Coordinate reference system of the model arrays.
         *         projected_bounds: North-up ``(xmin, ymin, xmax, ymax)`` grid extent in
         *             CRS units.
         *         resolution_m: Square cell size in meters for the authoritative
         *             EPSG:5070 runtime grid.
         *         rows: Number of array rows from north to south.
         *         cols: Number of array columns from west to east.
         */
        WildfireGridGeometry: {
            /** Cols */
            cols: number;
            /** Crs */
            crs: string;
            /** Name */
            name: string;
            /** Projected Bounds */
            projected_bounds: [
                number,
                number,
                number,
                number
            ];
            /** Resolution M */
            resolution_m: number;
            /** Rows */
            rows: number;
            wgs84_bounds?: components["schemas"]["BoundingBox"] | null;
        };
        /**
         * WildfireRunTrigger
         * @description Record the exact decision lineage that started a wildfire run.
         *
         *     Attributes:
         *         collision_trigger_id: Stable identifier for the verified collision
         *             decision that requested the run.
         *         weather_version: Exact UTC weather snapshot used by that decision.
         *         physics_result_version: Exact persisted power-line physics result used
         *             to verify the collision.
         *         ignition_location: WGS84 location passed to the wildfire workflow.
         */
        WildfireRunTrigger: {
            /** Collision Trigger Id */
            collision_trigger_id: string;
            ignition_location: components["schemas"]["IgnitionPoint"];
            /** Physics Result Version */
            physics_result_version: string;
            /**
             * Weather Version
             * Format: date-time
             */
            weather_version: string;
        };
        /**
         * WildfireSimulationRun
         * @description Persist the identity, trigger lineage, and lifecycle of one run.
         *
         *     Attributes:
         *         simulation_id: Stable simulation workflow identifier.
         *         run_id: Specific execution identifier within the simulation.
         *         region_id: Region evaluated by the wildfire run.
         *         trigger: Exact collision, weather, physics, and ignition lineage.
         *         status: Current durable run lifecycle state.
         *         grid_geometry: Exact model grid transform persisted before execution.
         *         created_at: UTC timestamp when the run record was created.
         *         started_at: UTC timestamp when a worker claimed or started execution.
         *         finished_at: UTC timestamp when the run reached a terminal state.
         *         tick_refs: Ordered wildfire snapshot references produced by the run.
         *         final_result_ref: Compact final output reference for a completed run.
         *         metrics: Authoritative final impact measurements for a completed run.
         *         failure: Compact terminal error detail for a failed run.
         */
        WildfireSimulationRun: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            failure?: components["schemas"]["SimulationRunFailure"] | null;
            /** Final Result Ref */
            final_result_ref?: string | null;
            /** Finished At */
            finished_at?: string | null;
            grid_geometry: components["schemas"]["WildfireGridGeometry"];
            metrics?: components["schemas"]["SimulationRunMetrics"] | null;
            /** Region Id */
            region_id: string;
            /** Run Id */
            run_id: string;
            /** Simulation Id */
            simulation_id: string;
            /** Started At */
            started_at?: string | null;
            status: components["schemas"]["SimulationRunStatus"];
            /**
             * Tick Refs
             * @default []
             */
            tick_refs: components["schemas"]["SimulationTickRef"][];
            /** Trigger */
            trigger: components["schemas"]["WildfireRunTrigger"] | components["schemas"]["ManualWildfireRunTrigger"] | components["schemas"]["ScenarioWildfireRunTrigger"];
        };
        /**
         * WindDirectionInput
         * @description Describe where wind travels as a clockwise bearing from true north.
         */
        WindDirectionInput: {
            /** Bearing Degrees */
            bearing_degrees: number;
            /**
             * Reference
             * @constant
             */
            reference: "towards";
        };
        /**
         * WindSpeedInput
         * @description Describe a nonnegative wind speed with an explicit supported unit.
         */
        WindSpeedInput: {
            /**
             * Unit
             * @enum {string}
             */
            unit: "mph" | "m/s";
            /** Value */
            value: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    get_readiness__get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthStatus"];
                };
            };
            /** @description Hosted Engine runtime is unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    list_data_sources_api_v1_data_sources_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfiguredDataSource"][];
                };
            };
        };
    };
    get_liveness_api_v1_health_live_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthStatus"];
                };
            };
        };
    };
    get_readiness_api_v1_health_ready_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthStatus"];
                };
            };
            /** @description Hosted Engine runtime is unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    get_map_layer_reading_api_v1_map_layers__layer_id__data_json_get: {
        parameters: {
            query: {
                latitude: number;
                longitude: number;
            };
            header?: never;
            path: {
                layer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapLayerReading"];
                };
            };
            /** @description Unknown map layer */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Source is not ready */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Artifact preparation or sampling is unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    get_map_layer_cog_api_v1_map_layers__layer_id__data_tif_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                layer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Requested COG byte range */
            206: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The cached artifact matches If-None-Match */
            304: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unknown map layer */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Source is not ready */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Artifact generation is temporarily unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    read_point_cloud_tile_api_v1_point_clouds__region_id___dataset_id___version___object_path__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                dataset_id: string;
                object_path: string;
                region_id: string;
                version: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_regions_api_v1_regions_get: {
        parameters: {
            query?: {
                cursor?: string | null;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_Region_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_region_api_v1_regions_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegionCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Region"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_region_api_v1_regions__region_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Region"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_region_api_v1_regions__region_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_region_api_v1_regions__region_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegionPatch"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Region"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_region_assets_api_v1_regions__region_id__assets_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": (components["schemas"]["SceneTreeAsset"] | components["schemas"]["ScenePowerLineAsset"] | components["schemas"]["ScenePowerPoleAsset"])[];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_region_asset_api_v1_regions__region_id__assets_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TreeAssetCreate"] | components["schemas"]["PowerLineAssetCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SceneTreeAsset"] | components["schemas"]["ScenePowerLineAsset"] | components["schemas"]["ScenePowerPoleAsset"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_region_asset_batch_api_v1_regions__region_id__assets_batch_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": (components["schemas"]["TreeAssetCreate"] | components["schemas"]["PowerLineAssetCreate"])[];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": (components["schemas"]["SceneTreeAsset"] | components["schemas"]["ScenePowerLineAsset"] | components["schemas"]["ScenePowerPoleAsset"])[];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_region_asset_csv_api_v1_regions__region_id__assets_csv_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_create_region_asset_csv_api_v1_regions__region_id__assets_csv_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": (components["schemas"]["SceneTreeAsset"] | components["schemas"]["ScenePowerLineAsset"] | components["schemas"]["ScenePowerPoleAsset"])[];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_region_assets_geojson_api_v1_regions__region_id__assets_geojson_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_asset_api_v1_regions__region_id__assets__asset_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                asset_id: string;
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SceneTreeAsset"] | components["schemas"]["PowerLineDetail"] | components["schemas"]["ScenePowerPoleAsset"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_asset_api_v1_regions__region_id__assets__asset_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                asset_id: string;
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_asset_api_v1_regions__region_id__assets__asset_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                asset_id: string;
                region_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AssetPatch"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SceneTreeAsset"] | components["schemas"]["ScenePowerLineAsset"] | components["schemas"]["ScenePowerPoleAsset"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_region_earth_engine_metadata_api_v1_regions__region_id__earth_engine_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EarthEngineMetadata"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_region_earth_engine_map_layers_api_v1_regions__region_id__earth_engine_map_layers_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapLayerCollection"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_region_point_cloud_datasets_api_v1_regions__region_id__point_cloud_datasets_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PointCloudDatasetCollection"];
                };
            };
            /** @description The requested region does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_region_point_cloud_dataset_api_v1_regions__region_id__point_cloud_datasets__dataset_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                dataset_id: string;
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PointCloudDatasetDescriptor"];
                };
            };
            /** @description The requested region or dataset does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description The dataset belongs to another region. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    submit_region_point_cloud_survey_api_v1_regions__region_id__point_cloud_datasets__dataset_id__surveys_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                dataset_id: string;
                region_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_submit_region_point_cloud_survey_api_v1_regions__region_id__point_cloud_datasets__dataset_id__surveys_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PointCloudSurveySubmission"];
                };
            };
            /** @description A verified operator identity is required. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description The configured region or dataset does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description The survey cannot extend the selected ready version. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description The uploaded survey exceeds the fixed intake limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description The uploaded file is not a PLY survey. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description The reviewed georeferencing metadata is invalid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    publish_region_api_v1_regions__region_id__publish_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Region"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_region_readiness_api_v1_regions__region_id__readiness_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegionReadiness"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_region_weather_datasets_api_v1_regions__region_id__weather_datasets_get: {
        parameters: {
            query?: {
                cursor?: string | null;
                limit?: number;
            };
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_WeatherDataset_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_weather_dataset_map_layers_api_v1_regions__region_id__weather_datasets__dataset_id__map_layers_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                dataset_id: string;
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MapLayerCollection"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_weather_dataset_station_observations_api_v1_regions__region_id__weather_datasets__dataset_id__station_observations_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                dataset_id: string;
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WeatherStationObservationCollection"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    resolve_region_weather_forecast_api_v1_regions__region_id__weather_forecasts_resolve_get: {
        parameters: {
            query: {
                issue_at_or_before: string;
                valid_at: string;
            };
            header?: never;
            path: {
                region_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ForecastDataset"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_scenarios_api_v1_scenarios_get: {
        parameters: {
            query?: {
                cursor?: string | null;
                limit?: number;
                region_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_SyntheticWindScenario_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_scenario_api_v1_scenarios_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ScenarioCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SyntheticWindScenario"];
                };
            };
            /** @description Region or exact base-weather version was not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Idempotency key identifies different scenario intent */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Scenario geometry or values are invalid */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    get_scenario_api_v1_scenarios__scenario_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                scenario_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SyntheticWindScenario"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_simulation_runs_api_v1_simulation_runs_get: {
        parameters: {
            query?: {
                cursor?: string | null;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_WildfireSimulationRun_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_simulation_run_api_v1_simulation_runs_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SimulationRunRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WildfireSimulationRun"] | components["schemas"]["AcceptedScenarioSimulationRun"];
                };
            };
            /** @description Selected scenario does not exist */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Idempotency or regional run ownership conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Simulation inputs violate the selected scenario */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    get_simulation_run_api_v1_simulation_runs__run_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WildfireSimulationRun"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    cancel_simulation_run_api_v1_simulation_runs__run_id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WildfireSimulationRun"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    stream_simulation_run_events_api_v1_simulation_runs__run_id__events_get: {
        parameters: {
            query?: never;
            header?: {
                "Last-Event-ID"?: string | null;
            };
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_simulation_result_geojson_api_v1_simulation_runs__run_id__result_geojson_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_simulation_tick_result_geojson_api_v1_simulation_runs__run_id__ticks__tick__result_geojson_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                run_id: string;
                tick: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
