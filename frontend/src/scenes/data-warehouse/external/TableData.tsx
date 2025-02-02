import { LemonButton, Link } from '@posthog/lemon-ui'
import { useActions, useValues } from 'kea'
import { EmptyMessage } from 'lib/components/EmptyMessage/EmptyMessage'
import { humanFriendlyDetailedTime } from 'lib/utils'
import { useEffect, useState } from 'react'
import { DatabaseTable } from 'scenes/data-management/database/DatabaseTable'
import { urls } from 'scenes/urls'

import { HogQLQueryEditor } from '~/queries/nodes/HogQLQuery/HogQLQueryEditor'
import { DatabaseSchemaTable, HogQLQuery, NodeKind } from '~/queries/schema'

import { viewLinkLogic } from '../viewLinkLogic'
import { dataWarehouseSceneLogic } from './dataWarehouseSceneLogic'

export function TableData(): JSX.Element {
    const {
        selectedRow: table,
        isEditingSavedQuery,
        inEditSchemaMode,
        editSchemaIsLoading,
        databaseLoading,
    } = useValues(dataWarehouseSceneLogic)
    const {
        deleteDataWarehouseSavedQuery,
        deleteDataWarehouseTable,
        setIsEditingSavedQuery,
        updateDataWarehouseSavedQuery,
        toggleEditSchemaMode,
        updateSelectedSchema,
        saveSchema,
        cancelEditSchema,
    } = useActions(dataWarehouseSceneLogic)
    const { toggleJoinTableModal, selectSourceTable } = useActions(viewLinkLogic)
    const [localQuery, setLocalQuery] = useState<HogQLQuery>()

    const isExternalTable = table?.type === 'data_warehouse'
    const isManuallyLinkedTable = isExternalTable && !table.source

    useEffect(() => {
        if (table && table.type === 'view') {
            setLocalQuery(table.query)
        }
    }, [table])

    const deleteButton = (selectedRow: DatabaseSchemaTable | null): JSX.Element => {
        if (!selectedRow) {
            return <></>
        }

        if (selectedRow.type === 'view') {
            return (
                <LemonButton
                    type="secondary"
                    onClick={() => {
                        deleteDataWarehouseSavedQuery(selectedRow.id)
                    }}
                >
                    Delete
                </LemonButton>
            )
        }

        if (selectedRow.type === 'data_warehouse') {
            return (
                <LemonButton
                    type="secondary"
                    onClick={() => {
                        deleteDataWarehouseTable(selectedRow.id)
                    }}
                >
                    Delete
                </LemonButton>
            )
        }

        if (selectedRow.type === 'posthog') {
            return <></>
        }

        return <></>
    }

    return table ? (
        <div className="px-4 py-3 col-span-2">
            <div className="flex flex-row justify-between items-center gap-2">
                <h3 className="text-wrap break-all leading-4">{table.name}</h3>
                {isEditingSavedQuery && (
                    <div className="flex flex-row gap-2 justify-between">
                        <LemonButton type="secondary" onClick={() => setIsEditingSavedQuery(false)}>
                            Cancel
                        </LemonButton>
                    </div>
                )}
                {inEditSchemaMode && (
                    <div className="flex flex-row gap-2 justify-between">
                        <LemonButton
                            type="primary"
                            loading={editSchemaIsLoading}
                            onClick={() => {
                                saveSchema()
                            }}
                        >
                            Save schema
                        </LemonButton>
                        <LemonButton
                            type="secondary"
                            disabledReason={editSchemaIsLoading && 'Schema is saving...'}
                            onClick={() => {
                                cancelEditSchema()
                            }}
                        >
                            Cancel edit
                        </LemonButton>
                    </div>
                )}
                {!inEditSchemaMode && !isEditingSavedQuery && (
                    <div className="flex flex-row gap-2 justify-between">
                        {deleteButton(table)}
                        <LemonButton
                            type="primary"
                            onClick={() => {
                                selectSourceTable(table.name)
                                toggleJoinTableModal()
                            }}
                        >
                            Add join
                        </LemonButton>
                        {isManuallyLinkedTable && (
                            <LemonButton
                                type="primary"
                                onClick={() => {
                                    toggleEditSchemaMode()
                                }}
                            >
                                Edit schema
                            </LemonButton>
                        )}
                        <Link
                            to={urls.insightNew(
                                undefined,
                                undefined,
                                JSON.stringify({
                                    kind: NodeKind.DataTableNode,
                                    full: true,
                                    source: {
                                        kind: NodeKind.HogQLQuery,
                                        // TODO: Use `hogql` tag?
                                        query: `SELECT ${Object.values(table.fields)
                                            .filter(
                                                ({ table, fields, chain, schema_valid }) =>
                                                    !table && !fields && !chain && schema_valid
                                            )
                                            .map(({ name }) => name)} FROM ${table.name} LIMIT 100`,
                                    },
                                })
                            )}
                        >
                            <LemonButton type="primary">Query</LemonButton>
                        </Link>
                        {table.type === 'view' && (
                            <LemonButton type="primary" onClick={() => setIsEditingSavedQuery(true)}>
                                Edit
                            </LemonButton>
                        )}
                    </div>
                )}
            </div>
            {table.type == 'data_warehouse' && (
                <div className="flex flex-col">
                    {table.source && table.schema && (
                        <>
                            <span className="card-secondary mt-2">Last Synced At</span>
                            <span>
                                {table.schema.last_synced_at
                                    ? humanFriendlyDetailedTime(table.schema.last_synced_at, 'MMMM DD, YYYY', 'h:mm A')
                                    : 'Not yet synced'}
                            </span>
                        </>
                    )}

                    {!table.source && (
                        <>
                            <span className="card-secondary mt-2">Files URL pattern</span>
                            <span className="break-all">{table.url_pattern}</span>

                            <span className="card-secondary mt-2">File format</span>
                            <span>{table.format}</span>
                        </>
                    )}
                </div>
            )}

            {!isEditingSavedQuery && (
                <div className="mt-2">
                    <span className="card-secondary">Columns</span>
                    <DatabaseTable
                        table={table.name}
                        tables={[table]}
                        inEditSchemaMode={inEditSchemaMode}
                        schemaOnChange={(key, type) => updateSelectedSchema(key, type)}
                    />
                </div>
            )}

            {table.type === 'view' && isEditingSavedQuery && (
                <div className="mt-2">
                    <span className="card-secondary">Update View Definition</span>
                    <HogQLQueryEditor
                        query={{
                            kind: NodeKind.HogQLQuery,
                            // TODO: Use `hogql` tag?
                            query: `${localQuery && localQuery.query}`,
                        }}
                        onChange={(queryInput) => {
                            setLocalQuery({
                                kind: NodeKind.HogQLQuery,
                                query: queryInput,
                            })
                        }}
                        editorFooter={(hasErrors, error, isValidView) => (
                            <LemonButton
                                className="ml-2"
                                onClick={() => {
                                    localQuery &&
                                        updateDataWarehouseSavedQuery({
                                            ...table,
                                            query: localQuery,
                                        })
                                }}
                                loading={databaseLoading}
                                type="primary"
                                center
                                disabledReason={
                                    hasErrors
                                        ? error ?? 'Query has errors'
                                        : !isValidView
                                        ? 'All fields must have an alias'
                                        : ''
                                }
                                data-attr="hogql-query-editor-save-as-view"
                            >
                                Save as View
                            </LemonButton>
                        )}
                    />
                </div>
            )}
        </div>
    ) : (
        <div className="px-4 py-3 h-100 col-span-2 flex justify-center items-center">
            <EmptyMessage
                title="No table selected"
                description="Please select a table from the list on the left"
                buttonText="Learn more about data warehouse tables"
                buttonTo="https://posthog.com/docs/data-warehouse"
            />
        </div>
    )
}
