import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

interface RouteCoordinate {
    lat: number;
    lon: number;
}

interface RouteResult {
    distance: number;
    path: number[];
    coordinates: RouteCoordinate[];
}

interface MapState {
    source: number | null;
    destination: number | null;
    route: RouteResult | null;
    loading: boolean;
    error: string | null;
    nodes: { id: number; lat: number; lon: number }[];
}

const initialState: MapState = {
    source: null,
    destination: null,
    route: null,
    loading: false,
    error: null,
    nodes: [],
};

export const fetchRoute = createAsyncThunk(
    "map/fetchRoute",
    async ({ source, destination }: { source: number; destination: number }, { rejectWithValue }) => {
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
            const response = await axios.post(`${apiBase}/api/route`, {
                source,
                destination,
            });
            return response.data as { success: boolean; distance: number; path: number[]; coordinates: RouteCoordinate[] };
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response) {
                return rejectWithValue(error.response.data.error || "Failed to fetch route");
            }
            return rejectWithValue("Network error");
        }
    }
);

const mapSlice = createSlice({
    name: "map",
    initialState,
    reducers: {
        setSource: (state, action: PayloadAction<number | null>) => {
            state.source = action.payload;
        },
        setDestination: (state, action: PayloadAction<number | null>) => {
            state.destination = action.payload;
        },
        clearRoute: (state) => {
            state.route = null;
            state.error = null;
        },
        setNodes: (state, action: PayloadAction<{ id: number; lat: number; lon: number }[]>) => {
            state.nodes = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchRoute.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchRoute.fulfilled, (state, action) => {
                state.loading = false;
                state.route = {
                    distance: action.payload.distance,
                    path: action.payload.path,
                    coordinates: action.payload.coordinates,
                };
            })
            .addCase(fetchRoute.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { setSource, setDestination, clearRoute, setNodes } = mapSlice.actions;
export default mapSlice.reducer;
