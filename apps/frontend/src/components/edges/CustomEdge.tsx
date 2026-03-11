'use client'

import { memo, useState } from 'react'
import { EdgeProps, getBezierPath, useReactFlow } from 'reactflow'
import { Trash2 } from 'lucide-react'

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow()
  const [isHovered, setIsHovered] = useState(false)
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteElements({ edges: [{ id }] })
  }

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Invisible wider path for better hover detection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
      />
      
      {/* Visible path */}
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        strokeWidth={selected ? 3 : 2}
      />
      
      {/* Delete button - appears on hover or when selected */}
      {(isHovered || selected) && (
        <foreignObject
          width={32}
          height={32}
          x={labelX - 16}
          y={labelY - 16}
          className="edge-button-foreign-object overflow-visible"
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div className="flex items-center justify-center h-full">
            <button
              onClick={handleDelete}
              className="bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg shadow-lg p-1.5 transition-colors"
              title="Deletar conexão"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </foreignObject>
      )}

      {/* Label if exists */}
      {label && (
        <foreignObject
          width={100}
          height={40}
          x={labelX - 50}
          y={labelY + (isHovered || selected ? 20 : -10)}
          className="edge-label-foreign-object"
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div className="flex items-center justify-center h-full">
            <div className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium px-2 py-1 rounded shadow-sm border border-gray-200 dark:border-gray-700">
              {label}
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  )
}

export default memo(CustomEdge)

